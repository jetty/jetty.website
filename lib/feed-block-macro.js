'use strict'

const toHash = (object) => object && !object.$$is_hash ? Opal.hash2(Object.keys(object), object) : object

const toProc = (fn) => Object.defineProperty(fn, '$$arity', { value: fn.length })

function register (registry, { file } = {}) {
  if (!registry) return this.register('feed', createExtensionGroup())
  registry.$groups().$store('feed', toProc(createExtensionGroup(file)))
  return registry
}

function createExtensionGroup (file) {
  return function () {
    this.blockMacro('feed', function () {
      this.process((parent, target, attrs) => {
        if (file) file.asciidoc.attributes['page-has-feeds'] = ''
        let currentParent = parent
        let sect
        if ('title' in attrs) {
          const title = attrs.title
          delete attrs.title
          attrs.role = `${attrs.role || ''} card-section`.trimStart()
          currentParent.append((sect = this.$create_section(parent, title, toHash(attrs))))
          currentParent = sect
        }
        const dataset = { feed: target }
        if ('max' in attrs) dataset.max = attrs.max
        const dataAttrlist = Object.entries(dataset).reduce((accum, [name, val]) => `${accum} data-${name}="${val}"`, '')
        const container = this.createPassBlock(currentParent, `<div class="card-entries"${dataAttrlist}></div>`, {})
        if (!sect) return container
        sect.append(container)
      })
    })
  }
}

module.exports = { register, createExtensionGroup }
