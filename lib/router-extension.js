'use strict'

/* Copyright (c) 2022-present OpenDevise Inc.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * This file was copied from the Antora Router Extension project and modified.
 * The original file can be found at the following URL:
 * https://gitlab.com/opendevise/oss/antora-router-extension/-/blob/129d832512b32d8fe48645dda50c389b61b49bc4/lib/index.js
 */
const fsp = require('node:fs/promises')
const ospath = require('node:path')

module.exports.register = function () {
  this.once('pagesComposed', async ({ playbook, contentCatalog }) => {
    const logger = this.getLogger('antora-router')
    const parseResourceRef = this.require('@antora/content-classifier/util/parse-resource-id')
    const yaml = this.require('js-yaml')
    const configFile = ospath.join(playbook.dir, 'antora-router.yml') // TODO make location configurable
    const config = yaml.load(await fsp.readFile(configFile), { schema: yaml.CORE_SCHEMA })
    const key = config.key ?? '' // Q: allow override per router?
    config.routers.forEach(({ page: routerPageRef, routes = {} }) => {
      const routerPageId = parseResourceRef(routerPageRef)
      const routerPage = getOrCreateRouterPage(contentCatalog, routerPageRef, routerPageId)
      if (!routerPage) return
      const routerPageUrl = routerPage.pub.url
      const resolvedRoutes = Object.entries(routes).reduce((accum, [name, to]) => {
        let hash = ''
        const hashIdx = to.indexOf('#')
        if (~hashIdx) {
          hash = to.substr(hashIdx)
          to = to.substr(0, hashIdx)
        }
        const pageUrl = contentCatalog.resolvePage(to, routerPageId)?.pub?.url
        if (pageUrl) {
          accum[name] = relativize(routerPageUrl, pageUrl, hash)
        } else {
          logger.warn('could not resolve URL for route to: %s: %s', name, to)
        }
        return accum
      }, {})
      if (!isEmptyObject(resolvedRoutes)) installOnPage(routerPage, key, resolvedRoutes)
    })
  })
}

function getOrCreateRouterPage (contentCatalog, ref, ctx) {
  const page = contentCatalog.resolvePage(ref)
  if (page) return page
  const componentVersion = ctx.version == null
    ? contentCatalog.getComponent(ctx.component)?.latest
    : contentCatalog.getComponentVersion(ctx.component, ctx.version)
  return componentVersion && contentCatalog.addFile({
    contents: Buffer.from(`<!DOCTYPE html>\n<meta charset="utf-8">\n<title>Redirect Notice</title>\n`),
    src: ctx,
  })
}

function installOnPage (routerPage, key, routes) {
  routerPage.contents = Buffer.from(routerPage.contents.toString().replace(/<\/title>/, `$&
<script>
;(function (routes, prefix, hash, href) {
  if (href = (hash && hash.startsWith(prefix) && routes[hash.slice(prefix.length)])) window.location.href = href
})(${JSON.stringify(routes, null, '  ')}, "#${key && key + '='}", window.location.hash)
</script>`))
}

function relativize (from, to, hash) {
  if (!(from && to.charAt() === '/')) return to
  if (from === to) return hash || (to.charAt(to.length - 1) === '/' ? './' : to.substr(to.lastIndexOf('/') + 1))
  const relativePath = computeRelativePath(from.slice(0, from.lastIndexOf('/')), to) || '.'
  return relativePath + (to.charAt(to.length - 1) === '/' ? '/' + hash : hash)
}

function computeRelativePath (from, to) {
  const fromParts = trimArray(from.split('/'))
  const toParts = trimArray(to.split('/'))
  let sharedPathLength = Math.min(fromParts.length, toParts.length)
  for (let i = 0; i < sharedPathLength; i++) {
    if (fromParts[i] === toParts[i]) continue
    sharedPathLength = i
    break
  }
  const outputParts = []
  for (let i = fromParts.length - sharedPathLength; i > 0; i--) outputParts.push('..')
  return outputParts.concat(toParts.slice(sharedPathLength)).join('/')
}

function trimArray (arr, length = arr.length, start = 0, end = length) {
  for (; start < length; start++) {
    if (arr[start]) break
  }
  if (start === length) return []
  for (; end > 0; end--) {
    if (arr[end - 1]) break
  }
  return arr.slice(start, end)
}

function isEmptyObject (obj) {
  for (const k in obj) return false
  return true
}
