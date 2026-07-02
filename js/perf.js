(function () {
  'use strict'

  var FA_BASE = 'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.2/css'
  var FA_FILES = ['fontawesome.min.css', 'solid.min.css', 'regular.min.css', 'brands.min.css']
  var fireworksLoaded = false
  var twCnLoaded = false

  function defer (cb, timeout) {
    if (window.requestIdleCallback) {
      window.requestIdleCallback(cb, { timeout: timeout || 2500 })
    } else {
      setTimeout(cb, timeout || 1200)
    }
  }

  function loadStylesheet (href) {
    return new Promise(function (resolve, reject) {
      var link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href
      link.onload = function () { resolve() }
      link.onerror = reject
      document.head.appendChild(link)
    })
  }

  function loadScript (src, attrs) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script')
      script.src = src
      script.async = true
      if (attrs) {
        Object.keys(attrs).forEach(function (key) {
          script.setAttribute(key, attrs[key])
        })
      }
      script.onload = resolve
      script.onerror = reject
      document.body.appendChild(script)
    })
  }

  function loadFontAwesome () {
    if (document.getElementById('fa-perf-loaded')) return Promise.resolve()
    var marker = document.createElement('meta')
    marker.id = 'fa-perf-loaded'
    document.head.appendChild(marker)
    return FA_FILES.reduce(function (chain, file) {
      return chain.then(function () { return loadStylesheet(FA_BASE + '/' + file) })
    }, Promise.resolve())
  }

  function enableNativeLazyLoad () {
    document.querySelectorAll('img:not([loading])').forEach(function (img) {
      if (img.classList.contains('avatar-img')) return
      if (img.closest('#page-header')) return
      img.loading = 'lazy'
      img.decoding = 'async'
    })
  }

  function loadFireworks () {
    if (fireworksLoaded) return
    if (window.matchMedia('(max-width: 768px)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    fireworksLoaded = true
    loadScript('https://cdn.jsdelivr.net/npm/butterfly-extsrc@1/dist/fireworks.min.js').catch(function () {})
  }

  function loadBusuanzi () {
    var uv = document.getElementById('busuanzi_value_site_uv')
    var pv = document.getElementById('busuanzi_value_site_pv')
    if (!uv && !pv) return

    function inject () {
      loadScript('//busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js', {
        'data-pjax': ''
      }).catch(function () {})
    }

    if ('IntersectionObserver' in window) {
      var target = uv || pv
      var observer = new IntersectionObserver(function (entries) {
        if (entries.some(function (entry) { return entry.isIntersecting })) {
          observer.disconnect()
          inject()
        }
      }, { rootMargin: '200px' })
      observer.observe(target)
      setTimeout(inject, 8000)
    } else {
      setTimeout(inject, 2500)
    }
  }

  function loadTwCn () {
    if (twCnLoaded || !document.getElementById('translateLink')) return
    twCnLoaded = true
    loadScript('/js/tw_cn.js').catch(function () {})
  }

  function bindOptionalFeatures () {
    var translateBtn = document.getElementById('translateLink')
    if (translateBtn) {
      translateBtn.addEventListener('mouseenter', loadTwCn, { once: true })
      translateBtn.addEventListener('focus', loadTwCn, { once: true })
      translateBtn.addEventListener('click', loadTwCn, { once: true })
    }

    var activateFireworks = function () {
      loadFireworks()
      window.removeEventListener('scroll', activateFireworks)
      window.removeEventListener('pointerdown', activateFireworks)
    }
    if (document.querySelector('canvas.fireworks')) {
      window.addEventListener('scroll', activateFireworks, { once: true, passive: true })
      window.addEventListener('pointerdown', activateFireworks, { once: true })
    }
  }

  enableNativeLazyLoad()
  bindOptionalFeatures()

  window.addEventListener('load', function () {
    defer(function () {
      loadFontAwesome()
      loadBusuanzi()
      if (document.getElementById('translateLink')) {
        setTimeout(loadTwCn, 5000)
      }
    }, 1800)
  })
})()
