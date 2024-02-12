'use strict'

/**
 * A temporary include processor to silence javadoc and $JETTY_HOME includes.
 */
function createExtensionGroup (registry) {
  return function () {
    this.includeProcessor(function () {
      let directive
      this.prepend() // register in front of Antora's include processor; calls this.$option('position', '>>') internally
      this.handles((target) => {
        if (target !== 'javadoc' && !target.startsWith('${jetty.home}')) return
        directive = registry.document.getReader().getLines()[0]
        return true
      })
      this.process((doc, reader, target, attrs) => {
        console.dir(directive)
        reader.pushInclude(directive, target, target, 1, attrs)
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
