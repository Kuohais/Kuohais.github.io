(function () {
  'use strict'

  if (!window.GLOBAL_CONFIG_SITE || !GLOBAL_CONFIG_SITE.isPost) return

  var bar = document.getElementById('read-progress-bar')
  var article = document.getElementById('article-container')
  if (!bar || !article) return

  function update () {
    var docHeight = article.clientHeight
    var winHeight = document.documentElement.clientHeight
    var headerHeight = article.offsetTop
    var scrollable = docHeight > winHeight ? docHeight - winHeight : document.documentElement.scrollHeight - winHeight
    var currentTop = window.scrollY || document.documentElement.scrollTop
    var percent = scrollable > 0 ? ((currentTop - headerHeight) / scrollable) * 100 : 0
    if (percent < 0) percent = 0
    if (percent > 100) percent = 100
    bar.style.width = percent + '%'
  }

  window.addEventListener('scroll', update, { passive: true })
  window.addEventListener('resize', update)
  update()
})()
