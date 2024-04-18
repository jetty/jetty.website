try {
  module.exports = require('antora-asciidoctor-extensions/absolute-path-include-processor')
} catch {
  module.exports.register = () => {}
}
