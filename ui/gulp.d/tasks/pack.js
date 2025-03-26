'use strict'

const ospath = require('node:path')
const { Transform } = require('node:stream')
const map = (transform) => new Transform({ objectMode: true, transform })
const vfs = require('vinyl-fs')
const zip = require('@vscode/gulp-vinyl-zip')
const zlib = require('node:zlib')

module.exports = (src, dest, bundleName, onFinish) => () =>
  vfs
    .src('**/*', { base: src, cwd: src, dot: true })
    .pipe(
      map(function (file, _, next) {
        if (file.relative.startsWith('font/')) {
          zlib.gzip(file.contents, (gzipErr, compressedContents) => {
            if (gzipErr) return next(gzipErr)
            this.push(
              new file.constructor({
                path: file.relative + '.gz',
                contents: compressedContents,
                stat: file.stat,
              })
            )
            next(null, file)
          })
        } else {
          next(null, file)
        }
      })
    )
    .pipe(zip.dest(ospath.join(dest, `${bundleName}-bundle.zip`)))
    .on('finish', () => onFinish && onFinish(ospath.resolve(dest, `${bundleName}-bundle.zip`)))
