'use strict'

/**
 * A temporary include processor to silence javadoc and $JETTY_HOME includes.
 */
function createExtensionGroup (registry) {
  return function () {
    this.includeProcessor(function () {
      let directive
      this.prefer() // register in front of Antora's include processor
      this.handles((target) => {
        if (target !== 'javadoc' && !target.startsWith('${jetty.home}')) return
        directive = registry.document.getReader().getLines()[0]
        return true
      })
      this.process((doc, reader, target, attrs) => {
        // append {empty} to prevent it from being recognized as macro when not in verbatim or raw block
        reader.pushInclude(directive + '{empty}', target, target, 1, attrs)
        return true
      })
    })
  }
}

module.exports.register = (registry) => {
  const toProc = (fn) => Object.defineProperty(fn, '$$arity', { value: fn.length })
  registry.$groups().$store('skip-include-processor', toProc(createExtensionGroup(registry)))
  return registry
}
