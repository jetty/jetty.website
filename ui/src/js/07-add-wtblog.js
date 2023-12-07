;(function () {
  'use strict'

  /* configuration */
  const _wtbURL = 'https://webtide.com/blog/feed/'
  const _wtbTitle = 'Jetty Blogs'
  const _wtbId = 'wtb-id'
  const _cardMaxNumber = 6
  var blogCard = document.getElementById(_wtbId)
  var xhttp = new window.XMLHttpRequest()

  if (blogCard) {
    window.addEventListener('load', function () {
      insertWTBlog()
    })
  }

  function insertWTBlog () {
    var feedXML

    xhttp.open('GET', _wtbURL)
    xhttp.send()

    xhttp.onload = (e) => {
      console.log(xhttp.responseType)

      if (xhttp.readyState == null) {
        console.log('response is null')
      }
      feedXML = xhttp.responseXML
      const items = feedXML.querySelectorAll('item')
      let html = `
            <div class="sect1 card-section">
              <h2 id="_wtb_title">${_wtbTitle}</h2>
              <div class="sectionbody">
        `
      var cardCount = 0
      items.forEach((el) => {
        if (cardCount < _cardMaxNumber) {
          html += `
            <div class="openblock card card-index">
                <div class="content">
                    <div class="paragraph">
                      <p>
                        <a href="${el.querySelector('link').innerHTML}">
                          <span class="card-title">${el.querySelector('title').innerHTML}</span>
                          <span class="card-body card-content-overflow">${el.querySelector('description').textContent}</span>
                        </a>
                      </p>
                    </div>
                </div>
            </div>
      `
        }
        ++cardCount
      })
      html += `
              </div>
           </div>
        `
      blogCard.insertAdjacentHTML('beforeend', html)
    }
  }
})()
