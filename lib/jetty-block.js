'use strict'

const fs = require('node:fs')
const ospath = require('node:path')
const { execFileSync } = require('node:child_process')

const MAIN_CLASS = {
  default: 'org.eclipse.jetty.tests.testers.RunJetty',
  11: 'org.eclipse.jetty.tests.hometester.RunJetty',
  10: 'org.eclipse.jetty.tests.hometester.RunJetty',
}

function createExtensionGroup (context) {
  return function () {
    let jettyHome, runJettyClasspath
    this.block(function () {
      this.named('jetty')
      this.onContext('literal')
      this.parseContentAs('verbatim')
      this.process((parent, reader, attrs) => {
        const doc = parent.getDocument()
        const cursor = doc.getReader().$cursor_at_mark()
        const lines = reader.getLines()
        if ((runJettyClasspath ??= resolveRunJettyClasspath(doc)) === false ||
            (jettyHome ??= resolveJettyHome(doc)) === false) {
          return this.createBlock(parent, 'literal', lines, attrs)
        }
        const jettyBase = jettyHome + '-base'
        fs.rmSync(jettyBase, { recursive: true, force: true })
        const config = lines.reduce((accum, line) => {
          if (line === '[jetty]') return accum
          const equalsIdx = line.indexOf('=')
          const name = line.slice(0, equalsIdx)
          if (name === 'highlight') attrs.subs = '+quotes'
          let val = line.slice(equalsIdx + 1)
          if (val.charAt() === '"') val = val.slice(1, val.length - 1)
          if (val.includes('{')) val = parent.applySubstitutions(val, ['attributes'])
          accum[name] = val
          return accum
        }, {})
        if ('setupModules' in config) {
          const setupModules = (config.setupModules ?? '').split(',').map((it) => it.trim()).filter((it) => it)
          if (setupModules.length) {
            const contentCatalog = context.contentCatalog
            const inSrc = cursor.file?.src || context.file.src
            const jettyModulesDir = ospath.join(jettyBase, 'modules')
            fs.mkdirSync(jettyModulesDir, { recursive: true })
            setupModules
              .map((ref) => [contentCatalog.resolveResource(ref, inSrc), ref])
              .filter(([resolved, ref]) => {
                if (resolved) return true
                log(doc, 'error', `resource in setupModules of jetty block could not be resolved: ${ref}`, cursor)
              })
              .forEach(([jettyModuleFile]) => {
                const jettyModulePath = ospath.join(jettyModulesDir, jettyModuleFile.src.basename)
                fs.writeFileSync(jettyModulePath, jettyModuleFile.contents, 'utf-8')
              })
          }
        }
        const args = []
        args.push('-cp', runJettyClasspath)
        const mainClass = MAIN_CLASS[doc.getAttribute('page-version')] || MAIN_CLASS.default
        args.push(mainClass)
        args.push('--jetty-home=' + jettyHome)
        args.push('--jetty-version=' + doc.getAttribute('version'))
        const runJettyArgs = Object.entries(config).reduce((accum, [name, val]) => {
          if (name !== 'setupModules') {
            args.push(buildExecArg(name, val))
            accum.push(args[args.length - 1])
          }
          return accum
        }, [])
        console.log(
          '[exec] java -cp $RUN_JETTY_CLASSPATH ' + mainClass + ' --jetty-home=$JETTY_HOME' +
          (runJettyArgs.length ? ' ' + runJettyArgs.map((it) => it.replace('=', '="') + '"').join(' ') : '')
        )
        try {
          const includeContents = execFileSync('java', args, { stdio: 'pipe', windowsHide: true }).toString().trim()
          if (includeContents) {
            //console.log(includeContents)
            if (includeContents.startsWith('**')) attrs.subs = '+quotes'
            return this.createBlock(parent, 'literal', includeContents, attrs)
          } else {
            log(doc, 'error', `${mainClass} no output`, cursor)
            return this.createBlock(parent, 'literal', lines, attrs)
          }
        } catch (e) {
          const message = [
            `${mainClass} failed:`,
            e.stderr.toString().trimEnd(),
            `RUN_JETTY_CLASSPATH=${runJettyClasspath}`
          ].join('\n')
          log(doc, 'error', message, cursor)
          return this.createBlock(parent, 'literal', lines, attrs)
        }
      })
    })
  }
}

function resolveJettyHome (doc) {
  const value = doc.getAttribute('jetty-home')
  return value && value !== '${jetty.home}' && ospath.isAbsolute(value) ? value : false
}

function resolveRunJettyClasspath (doc) {
  const value = doc.getAttribute('run-jetty-classpath')
  return value && !value.endsWith('${run.jetty.classpath}') ? value : false
}

function buildExecArg (name, val) {
  return '--' + name.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()) + '=' + val
}

function log (doc, level, message, cursor) {
  return doc.getLogger()[level](cursor ? doc.createLogMessage(message, { source_location: cursor }) : message)
}

module.exports.register = (registry, context) => {
  if (!context) return // NOTE only works as scoped extension
  const toProc = (fn) => Object.defineProperty(fn, '$$arity', { value: fn.length })
  registry.$groups().$store('jetty-include', toProc(createExtensionGroup(context)))
  return registry
}
