'use strict'

/* Copyright (c) 2018 OpenDevise, Inc.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/**
 * A custom include processor that handles includes for which the target is an absolute path.
 *
 * @author Dan Allen <dan@opendevise.com>
 */
const fs = require('node:fs')
const ospath = require('node:path')

const DBL_COLON = '::'
const DBL_SQUARE = '[]'
const NEWLINE_RX = /\r\n?|\n/
const TAG_DIRECTIVE_RX = /\b(?:tag|(e)nd)::(\S+?)\[\](?=$|[ \r])/m

function createExtensionGroup () {
  return function () {
    this.includeProcessor(function () {
      this.prepend() // register in front of Antora's include processor
      this.handles((target) => ospath.isAbsolute(target))
      this.process((doc, reader, target, attrs) => {
        let contents, applyFilter
        let startLineNum = 1
        try {
          contents = fs.readFileSync(target, 'utf-8')
          applyFilter = true
        } catch {
          const cursor = reader.$cursor_at_prev_line()
          const message = doc.createLogMessage(`include file not found: ${target}`, { source_location: cursor })
          doc.getLogger().error(message)
          contents = `Unresolved directive in ${reader.path} - include::${target}[]`
        }
        if (applyFilter) {
          const tags = getTags(attrs)
          if (tags) {
            const file = { contents, file: target }
            const sourceCursor = reader.$cursor_at_prev_line()
            ;[contents, startLineNum] = filterLinesByTags(reader, file, target, tags, sourceCursor)
          }
        }
        reader.pushInclude(contents, target, target, startLineNum, attrs)
      })
    })
  }
}

function getTags (attrs) {
  if ('tag' in attrs) {
    const tag = attrs.tag
    if (tag && tag !== '!') {
      return tag.charAt() === '!' ? new Map().set(tag.substr(1), false) : new Map().set(tag, true)
    }
  } else if ('tags' in attrs) {
    const tags = attrs.tags
    if (tags) {
      const result = new Map()
      let any = false
      tags.split(~tags.indexOf(',') ? ',' : ';').forEach((tag) => {
        if (tag && tag !== '!') {
          any = true
          tag.charAt() === '!' ? result.set(tag.substr(1), false) : result.set(tag, true)
        }
      })
      if (any) return result
    }
  }
}

function filterLinesByTags (reader, file, target, tags, sourceCursor) {
  let selectingDefault, selecting, wildcard
  const globstar = tags.get('**')
  const star = tags.get('*')
  if (globstar === undefined) {
    if (star === undefined) {
      selectingDefault = selecting = !mapContainsValue(tags, true)
    } else {
      if ((wildcard = star) || tags.keys().next().value !== '*') {
        selectingDefault = selecting = false
      } else {
        selectingDefault = selecting = !wildcard
      }
      tags.delete('*')
    }
  } else {
    tags.delete('**')
    selectingDefault = selecting = globstar
    if (star === undefined) {
      if (!globstar && tags.values().next().value === false) wildcard = true
    } else {
      tags.delete('*')
      wildcard = star
    }
  }

  const lines = []
  const tagStack = []
  const foundTags = []
  let activeTag
  let lineNum = 0
  let startLineNum
  file.contents.split(NEWLINE_RX).forEach((line) => {
    lineNum++
    let m
    if (~line.indexOf(DBL_COLON) && ~line.indexOf(DBL_SQUARE) && (m = line.match(TAG_DIRECTIVE_RX))) {
      const thisTag = m[2]
      if (m[1]) {
        if (thisTag === activeTag) {
          tagStack.shift()
          ;[activeTag, selecting] = tagStack.length ? tagStack[0] : [undefined, selectingDefault]
        } else if (tags.has(thisTag)) {
          const idx = tagStack.findIndex(([name]) => name === thisTag)
          if (~idx) {
            tagStack.splice(idx, 1)
            log(
              reader,
              'warn',
              `mismatched end tag (expected '${activeTag}' but found '${thisTag}') ` +
                `at line ${lineNum} of include file: ${file.file})`,
              sourceCursor,
              createIncludeCursor(reader, file, target, lineNum)
            )
          } else {
            log(
              reader,
              'warn',
              `unexpected end tag '${thisTag}' at line ${lineNum} of include file: ${file.file}`,
              sourceCursor,
              createIncludeCursor(reader, file, target, lineNum)
            )
          }
        }
      } else if (tags.has(thisTag)) {
        foundTags.push(thisTag)
        tagStack.unshift([(activeTag = thisTag), (selecting = tags.get(thisTag)), lineNum])
      } else if (wildcard !== undefined) {
        selecting = activeTag && !selecting ? false : wildcard
        tagStack.unshift([(activeTag = thisTag), selecting, lineNum])
      }
    } else if (selecting) {
      if (!startLineNum) startLineNum = lineNum
      lines.push(line)
    }
  })
  if (tagStack.length) {
    tagStack.forEach(([tagName, _, tagLineNum]) =>
      log(
        reader,
        'warn',
        `detected unclosed tag '${tagName}' starting at line ${tagLineNum} of include file: ${file.file}`,
        sourceCursor,
        createIncludeCursor(reader, file, target, tagLineNum)
      )
    )
  }
  if (foundTags.length) foundTags.forEach((name) => tags.delete(name))
  if (tags.size) {
    log(
      reader,
      'warn',
      `tag${tags.size > 1 ? 's' : ''} '${[...tags.keys()].join(', ')}' not found in include file: ${file.file}`,
      sourceCursor,
      createIncludeCursor(reader, file, target, 0)
    )
  }
  return [lines, startLineNum || 1]
}

function createIncludeCursor (reader, { file, src }, path, lineno) {
  return reader.$create_include_cursor(
    Object.assign(new String(file), { src, parent: { file: reader.file, lineno: reader.lineno - 1 } }),
    path,
    lineno
  )
}

function log (reader, level, message, sourceCursor, includeCursor) {
  const context = includeCursor
    ? { source_location: sourceCursor, include_location: includeCursor }
    : { source_location: sourceCursor }
  reader.getLogger()[level](reader.createLogMessage(message, context))
}

function mapContainsValue (map, value) {
  for (const v of map.values()) {
    if (v === value) return true
  }
}

module.exports.register = (registry) => {
  const toProc = (fn) => Object.defineProperty(fn, '$$arity', { value: fn.length })
  registry.$groups().$store('absolute-path-include-processor', toProc(createExtensionGroup()))
  return registry
}
