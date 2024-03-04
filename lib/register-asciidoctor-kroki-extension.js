'use strict'

module.exports.register = function () {
  this.on('playbookBuilt', ({ playbook }) => {
    try {
      this.require('asciidoctor-kroki')
      // or...
      //require.resolve('asciidoctor-kroki', { paths: this.module.require.main.paths })
      playbook.asciidoc.extensions.push('asciidoctor-kroki')
    } catch {}
  })
}
