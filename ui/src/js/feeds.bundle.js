;(function () {
  'use strict'

  var feeds = [].slice.call(document.querySelectorAll('.doc [data-feed]'))
  if (!feeds.length) return

  var template = document.getElementById('card-entry')
  if (!(template && (template = template.content.querySelector('.card-block')))) return

  var XMLHttpRequest = window.XMLHttpRequest

  feeds.forEach(insertFeed)

  function insertFeed (feed) {
    try {
      var url = feed.dataset.feed
      var max = Number(feed.dataset.max) || Infinity
      var xhr = new XMLHttpRequest()
      xhr.open('GET', url)
      xhr.addEventListener('load', function () {
        var items = [].slice.call(this.responseXML.querySelectorAll('item'), 0, max)
        items.forEach(function (item) {
          var entry = template.cloneNode(true)
          entry.querySelector('.card-link').setAttribute('href', item.querySelector('link').textContent)
          entry.querySelector('.card-title').innerHTML = item.querySelector('title').innerHTML
          entry.querySelector('.card-content p').innerHTML = item.querySelector('description').textContent
          feed.appendChild(entry)
        })
      })
    } catch (e) {
      console.error('Failed to retrieve feed: ' + url + '.', e)
    }
    xhr.send(null)
  }
})()
