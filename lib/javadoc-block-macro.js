'use strict'

const toHash = (object) => object && !object.$$is_hash ? Opal.hash2(Object.keys(object), object) : object

const toProc = (fn) => Object.defineProperty(fn, '$$arity', { value: fn.length })

function register (registry, context = {}) {
  if (!(registry && context)) return // NOTE only works as scoped extension
  registry.$groups().$store('javadoc', toProc(createExtensionGroup(context)))
  return registry
}

function createExtensionGroup ({ contentCatalog, file }) {
  return function () {
    this.blockMacro('javadoc', function () {
      this.process((parent, target, attrs) => {
        const doc = parent.getDocument()
        const cursor = doc.getReader().$cursor_at_mark()
        const ctx = (cursor.file || {}).src || file.src
        const includeFile = contentCatalog.resolveResource(target, ctx, undefined, ['partial'])
        if (!includeFile) return this.createParagraph(parent, `javadoc::${target}[]`, {})
        const rawLines = includeFile.contents.toString().split('\n')
        const lines = []
        let capturing
        for (let line of rawLines) {
          if (capturing) {
            if (line.endsWith('<!-- end::documentation[] -->')) break
            line = line.replace(/^ +[*](?: +|$)/, '')
            if (line === '<table>') {
              line = '<table class="tableblock frame-all grid-all stretch">'
            } else if (line === '<dl>') {
              lines.push('<div class="dlist">')
            } else if (line === '</dl>') {
              lines.push(line)
              line = '</div>'
            } else if (line.startsWith('<p') && !lines.length) {
              line = '<div class="paragraph">\n' + line + '\n</div>'
            } else if (line.startsWith('<!--')) {
              continue
            }
            lines.push(line)
          } else if (line.endsWith('<!-- tag::documentation[] -->')) {
            capturing = true
            continue
          }
        }
        return this.createPassBlock(parent, lines, {})
      })
    })
  }
}

module.exports = { register, createExtensionGroup }
