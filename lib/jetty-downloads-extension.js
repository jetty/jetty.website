'use strict'

const MAVEN_REPO_URL = 'https://repo1.maven.org/maven2'
const JAVADOC_ROOT_URL = 'https://javadoc.jetty.org'
const REPOSITORY = 'jetty/jetty.project'
const GROUP_ID = 'org.eclipse.jetty'
const ARTIFACT_ID = 'jetty-home'

module.exports.register = function ({ config }) {
  const { firstMajorVersion = 9, lastEolVersion, lastMajorVersion } = config
  this.once('contentClassified', async ({ contentCatalog }) => {
    const { Octokit } = this.require('@octokit/rest')
    const octokit = new Octokit()
    const [owner, repo] = REPOSITORY.split('/')
    const releases = await collectLatestReleases({ octokit, owner, repo, firstMajorVersion, lastMajorVersion })
    const majorVersions = Object.keys(releases).sort((a, b) => b.localeCompare(a, 'en', { numeric: true })).map(Number)
    const rows = []
    for (const majorVersion of majorVersions) {
      const release = releases[majorVersion]
      const cells = []
      cells.push(lastEolVersion && majorVersion <= lastEolVersion ? `${release.version} (EOL)` : release.version)
      cells.push(`${release.zip}[.zip${release.zipHash ? ',title=' + release.zipHash + ' (sha1)' : ''}]`)
      cells.push(`${release.tgz}[.tgz${release.tgzHash ? ',title=' + release.tgzHash + ' (sha1)' : ''}]`)
      cells.push(`${release.url}[Release Notes] / ${release.api}[API Docs]`)
      rows.push(cells.map((it) => '|' + it).join(' '))
    }
    const partial = contentCatalog.resolveResource('ROOT::partial$jetty-downloads.adoc')
    partial.contents = Buffer.from(rows.map((it) => '\n\n' + it).join(''))
  })
}

function collectLatestReleases ({ octokit, owner, repo, firstMajorVersion, lastMajorVersion, page = 1, accum = {} }) {
  return octokit.repos.listReleases({ owner, repo, page, per_page: 50 }).then(async (result) => {
    for (const release of result.data) {
      // we will need 12.1, but we do not want to include 9.3.x releases
      if (release.draft || release.name.startsWith("9.3")) continue
      const version = release.name
      const majorVersion = Number(version.split('.')[0]+"."+version.split('.')[1])
      if (majorVersion in accum || majorVersion < firstMajorVersion) continue
      const groupId = GROUP_ID
      const artifactId = majorVersion < 10 ? 'jetty-distribution' : ARTIFACT_ID
      const distBaseUrl = `${MAVEN_REPO_URL}/${groupId.replace(/[.]/g, '/')}/${artifactId}/${version}/${artifactId}-${version}`
      const tgz = `${distBaseUrl}.tar.gz`
      const tgzHash = await fetch(`${tgz}.sha1`).then((response) => response.text(), () => undefined)
      if (!tgzHash) continue // not yet available in the Maven repo
      const zip = `${distBaseUrl}.zip`
      const zipHash = await fetch(`${zip}.sha1`).then((response) => response.text(), () => undefined)
      if (!zipHash) continue // not yet available in the Maven repo
      accum[majorVersion] = {
        version: release.name,
        date: release.created_at,
        tgz,
        tgzHash,
        zip,
        zipHash,
        url: release.html_url,
        api: `${JAVADOC_ROOT_URL}/jetty-${majorVersion}/index.html`,
      }
    }
    if (lastMajorVersion && createRange(firstMajorVersion, lastMajorVersion).every((it) => it in accum)) return accum
    const links = result.headers.link
    if (links && links.includes('; rel="next"')) {
      return collectLatestReleases({ octokit, owner, repo, firstMajorVersion, lastMajorVersion, page: page + 1, accum })
    }
    return accum
  })
}

function createRange (from, to) {
  const result = []
  for (let i = from; i <= to; i++) result.push(i)
  return result
}
