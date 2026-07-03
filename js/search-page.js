(function () {
  'use strict'

  var input = document.querySelector('#search-page-input')
  var results = document.getElementById('search-page-results')
  if (!input || !results || !window.GLOBAL_CONFIG || !GLOBAL_CONFIG.localSearch) return

  var datas = []

  function stripHtml (html) {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }

  function parseSearchKeywords (query) {
    return query.trim().toLowerCase().split(/[\s]+/).filter(function (s) { return s.length > 0 })
  }

  function getValidSearchKeywords (keywords) {
    return keywords.filter(function (kw) { return kw.length >= 2 })
  }

  var QUERY_TOO_SHORT_MSG = '请输入至少 2 个字符的关键词（不支持单字、单数字或单个符号）'

  function render (keywords) {
    if (!keywords.length) {
      results.innerHTML = ''
      return
    }

    var validKeywords = getValidSearchKeywords(keywords)
    if (!validKeywords.length) {
      results.innerHTML = '<div id="search-page-empty">' + QUERY_TOO_SHORT_MSG + '</div>'
      return
    }
    keywords = validKeywords

    var html = '<div class="search-result-list">'
    var count = 0

    datas.forEach(function (data) {
      var title = (data.title || 'Untitled').trim()
      var dataTitle = title.toLowerCase()
      var dataContent = stripHtml(data.content).toLowerCase()
      var dataUrl = data.url.startsWith('/') ? data.url : GLOBAL_CONFIG.root + data.url
      var match = true
      var indexTitle = -1
      var indexContent = -1
      var firstOccur = -1

      keywords.forEach(function (keyword) {
        indexTitle = dataTitle.indexOf(keyword)
        indexContent = dataContent.indexOf(keyword)
        if (indexTitle < 0 && indexContent < 0) match = false
        if (indexContent >= 0 && (firstOccur < 0 || indexContent < firstOccur)) firstOccur = indexContent
      })

      if (!match) return
      count += 1

      var showTitle = title
      var showContent = ''
      keywords.forEach(function (keyword) {
        var reg = new RegExp(keyword, 'gi')
        showTitle = showTitle.replace(reg, function (m) { return '<span class="search-keyword">' + m + '</span>' })
      })

      if (firstOccur >= 0) {
        var start = Math.max(firstOccur - 20, 0)
        showContent = stripHtml(data.content).substr(start, 120)
        keywords.forEach(function (keyword) {
          var reg = new RegExp(keyword, 'gi')
          showContent = showContent.replace(reg, function (m) { return '<span class="search-keyword">' + m + '</span>' })
        })
      }

      html += '<div class="local-search__hit-item"><a class="search-result-title" href="' + dataUrl + '">' + showTitle + '</a>'
      if (showContent) html += '<p class="search-result">' + showContent + '...</p>'
      html += '</div>'
    })

    if (!count) {
      html += '<div id="search-page-empty">' + GLOBAL_CONFIG.localSearch.languages.hits_empty.replace(/\$\{query}/, input.value.trim()) + '</div>'
    }

    html += '</div>'
    results.innerHTML = html
  }

  fetch(GLOBAL_CONFIG.root + GLOBAL_CONFIG.localSearch.path)
    .then(function (response) { return response.text() })
    .then(function (str) { return new window.DOMParser().parseFromString(str, 'text/xml') })
    .then(function (xml) {
      datas = Array.prototype.slice.call(xml.querySelectorAll('entry')).map(function (item) {
        return {
          title: item.querySelector('title').textContent,
          content: item.querySelector('content').textContent,
          url: item.querySelector('url').textContent
        }
      })

      var params = new URLSearchParams(window.location.search)
      var q = params.get('q')
      if (q) {
        input.value = q
        render(parseSearchKeywords(q))
      }

      input.addEventListener('input', function () {
        var value = this.value.trim()
        if (!value) {
          results.innerHTML = ''
          return
        }
        render(parseSearchKeywords(value))
      })
    })
    .catch(function () {
      results.innerHTML = '<div id="search-page-empty">搜索数据加载失败，请稍后重试。</div>'
    })
})()
