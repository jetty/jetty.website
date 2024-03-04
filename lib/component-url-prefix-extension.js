'use strict'

const path = require('node:path/posix')

module.exports.register = function ({ config: { prefix = 'docs' } }) {
  if ((prefix = path.join('.', prefix || '', '.')) === '.' || prefix === '..') return
  this.once('contentClassified', ({ contentCatalog }) => {
    contentCatalog.getComponents().filter(({ name }) => applyTo(name, prefix)).forEach(({ versions }) => {
      versions.forEach((version) => {
        version.url = `/${prefix}${version.url}`
      })
    })
    contentCatalog.getFiles().filter((file) => file.out && applyTo(file.src.component, prefix)).forEach(({ out, pub }) => {
      out.path = path.join((out.dirname = path.join(prefix, out.dirname)), out.basename)
      out.rootPath = path.join('..', out.rootPath)
      pub.url = `/${prefix}${pub.url}`
      pub.rootPath = path.join('..', pub.rootPath)
    })
  })
}

function applyTo (name, prefix) {
  return !(name === 'ROOT' || name === prefix)
}
