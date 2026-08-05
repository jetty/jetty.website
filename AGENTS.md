# Copilot instructions for jetty.website

This repository is the **Antora playbook** for the Eclipse Jetty website (https://jetty.org).
It assembles content written in AsciiDoc from this repo and from the remote `jetty/jetty.project`
repository into a static site. It is a build/orchestration project, not a typical application.

## Build and preview

The build runs Antora through the Antora Maven plugin. You do **not** need Node.js or npm
installed and should **not** run `npm install` — the Maven plugin provisions Node.js (into
`target/node/`) and installs npm packages (into `node_modules/`) on first run.

- Quick site build: `./mvnw antora` (or `mvn antora`). The generated site path is printed in the Maven log; output goes to `target/site`.
- Work offline after a first run: `mvn antora -Dantora.option.fetch?=false`, or use the `cached` profile: `mvn antora:antora@cached`.
- Enable diagrams (Kroki): `mvn antora:antora@kroki`.
- Full production build (matches CI): `mvn antora:antora@full`. This requires `ANTORA_CACHE_DIR` to be set so the Antora Collector does not delete Jetty Home (see `.github/workflows/publish-site.yml`).
- Pass raw options to Antora via `-Dantora.option.<name>` user properties, e.g. `-Dantora.option.extension[1]=jetty-download`.

There is no test or lint suite for the playbook itself. Validate changes by running a build and
watching the Maven/Antora log for warnings (the full build uses `--log-failure-level warn`).

## Architecture (the big picture)

- **`antora-playbook.yml`** is the entry point. It wires together content sources, Antora
  extensions (from `lib/`), asciidoc macros (from `lib/`), and the UI bundle.
- **Content comes from two places**: local directories in this repo (`home`, `docs-home`,
  `contribution-guide` — each an Antora component with its own `antora.yml` and `modules/`),
  and the remote `jetty/jetty.project` repo, whose `documentation/jetty/` is pulled from
  multiple maintenance branches (`jetty-10.0.x`, `jetty-11.0.x`, `jetty-12.0.x`, `jetty-12.1.x`).
  Most Jetty documentation lives in that other repo, not here.
- **`lib/`** holds custom JavaScript that extends Antora and Asciidoctor. Registered Antora
  extensions include `component-url-prefix-extension.js` (prefixes non-ROOT components under
  `/docs`), `jetty-downloads-extension.js`, and `router-extension.js`. Registered Asciidoctor
  macros include `jetty-block.js`, `javadoc-block-macro.js`, and `feed-block-macro.js`. When
  changing site behavior, prefer editing/adding an extension here over hand-editing generated output.
- **`antora-router.yml`** defines stable named routes (consumed by `router-extension.js`) so links
  survive documentation restructuring. Add a route here rather than hardcoding version-specific URLs.
- **`ui/`** is a separate sub-project (a fork of the Antora default UI) that produces the visual
  theme as `ui-bundle.zip`. The playbook consumes the published bundle from a GitHub release
  (`ui-prod-latest`), **not** the local `ui/` sources — editing `ui/` alone will not change a
  local `mvn antora` build until the bundle is rebuilt/released.

## UI sub-project (`ui/`)

Built with Gulp via the frontend Maven plugin (has its own `pom.xml`/`package.json`):

- Bundle the UI: `mvn process-resources` (run from `ui/`).
- Run a specific Gulp task: `mvn process-resources -Dtask=preview`, or after first init
  `mvn frontend:npx@gulp -Dtask=preview`.
- List Gulp tasks: `mvn frontend:npx@gulp -Dtask=--tasks`.

## Conventions

- All content is AsciiDoc (`.adoc`). Antora attributes (e.g. `idseparator`, `page-pagination`) are
  configured centrally in `antora-playbook.yml` — do not redefine them per page.
- `lib/` JavaScript uses `'use strict'` and CommonJS, and is MPL-2.0 licensed (files adapted from
  Antora/OpenDevise retain their original license headers).
- Deployment: `main` pushes trigger `.github/workflows/publish-site.yml`, which runs
  `antora:antora@full` and deploys `target/site` to GitHub Pages. `ui/**` changes are handled by
  `.github/workflows/release-ui.yml` and are excluded from the publish workflow.
- `Jenkinsfile` + `jetty-website.sh` drive a separate staged build on Jenkins (`stage`/`release`
  directives); the shell script is the source of truth for staging/promotion logic.
