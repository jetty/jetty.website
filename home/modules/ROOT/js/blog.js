const Blog = function () {

    const _blogUrl = "https://webtide.com/blog/feed";


    this.generate = function () {

        fetch(_blogUrl)
            .then(response => response.text())
            .then(str => new window.DOMParser().parseFromString(str, "text/xml"))
            .then(data => {
                console.log(data);
                const items = data.querySelectorAll("item");
                let html = `<div class="sectionbody">`;
                items.forEach(el => {
                    html += `
        <div class="openblock card card-index">
            <div class="content">
                <div class="paragraph">
                    <p><a href="${el.querySelector("link").innerHTML}" class="xref page"><span class="card-title">${el.querySelector("title").innerHTML}</span>
                        <span class="card-body card-content-overflow">${el.querySelector("description").innerHTML}</span></a>
                    </p>
                </div>
            </div>
        </div>
      `;
                });
                html += `</div>`;
                document.body.insertAdjacentHTML("blogs", html);
            });


    }


}