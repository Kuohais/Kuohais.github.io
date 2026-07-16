(function () {
  'use strict'

  var FA_BASE = 'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.2/css'
  var FA_FILES = ['fontawesome.min.css', 'solid.min.css', 'regular.min.css', 'brands.min.css']
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
    return Promise.all(FA_FILES.map(function (file) {
      return loadStylesheet(FA_BASE + '/' + file)
    }))
  }

  function enableNativeLazyLoad () {
    document.querySelectorAll('img:not([loading])').forEach(function (img) {
      if (img.classList.contains('avatar-img')) return
      if (img.closest('#page-header')) return
      img.loading = 'lazy'
      img.decoding = 'async'
    })
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
  }

  /* 代码块：Mac 圆点 + 语言标签 + 复制按钮 */
  function enhanceCodeBlocks () {
    var figures = document.querySelectorAll('#article-container figure.highlight')
    figures.forEach(function (figure) {
      if (figure.querySelector('.kitchas-code-header')) return

      var lang = ''
      figure.classList.forEach(function (cls) {
        if (cls !== 'highlight') lang = cls
      })
      if (lang === 'plain' || lang === 'plaintext') lang = 'text'

      var header = document.createElement('div')
      header.className = 'kitchas-code-header'
      header.innerHTML =
        '<span class="kitchas-code-dots"><i></i><i></i><i></i></span>' +
        '<span class="kitchas-code-lang">' + lang + '</span>' +
        '<button class="kitchas-code-copy" type="button" aria-label="复制代码">复制</button>'
      figure.insertBefore(header, figure.firstChild)

      header.querySelector('.kitchas-code-copy').addEventListener('click', function () {
        var btn = this
        var code = figure.querySelector('td.code pre') || figure.querySelector('pre')
        if (!code) return
        var text = code.innerText.replace(/\n$/, '')

        function done (ok) {
          btn.textContent = ok ? '已复制' : '失败'
          btn.classList.toggle('kitchas-code-copy--ok', ok)
          setTimeout(function () {
            btn.textContent = '复制'
            btn.classList.remove('kitchas-code-copy--ok')
          }, 1600)
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { done(true) }, function () { done(false) })
        } else {
          var ta = document.createElement('textarea')
          ta.value = text
          document.body.appendChild(ta)
          ta.select()
          try { done(document.execCommand('copy')) } catch (e) { done(false) }
          ta.remove()
        }
      })
    })
  }

  /* 文章页：潜水深度阅读进度 */
  function initDepthMeter () {
    if (!document.querySelector('#post #article-container')) return
    if (document.getElementById('kitchas-depth')) return

    var pill = document.createElement('div')
    pill.id = 'kitchas-depth'
    pill.setAttribute('aria-hidden', 'true')
    pill.innerHTML = '<span class="kitchas-depth__icon">🌊</span><span id="kitchas-depth-text">-0m</span>'
    document.body.appendChild(pill)

    var textEl = pill.querySelector('#kitchas-depth-text')
    var ticking = false

    function update () {
      ticking = false
      var doc = document.documentElement
      var total = doc.scrollHeight - window.innerHeight
      if (total <= 0) return
      var progress = Math.min(1, Math.max(0, (window.scrollY || doc.scrollTop) / total))
      // 海底深度随文章长度变化：越长潜得越深
      var seabed = Math.max(20, Math.round(doc.scrollHeight / 60))

      if (progress <= 0.02) {
        pill.classList.remove('kitchas-depth--show')
        return
      }
      pill.classList.add('kitchas-depth--show')
      if (progress >= 0.985) {
        pill.firstChild.textContent = '⚓'
        textEl.textContent = '已至海底 -' + seabed + 'm'
      } else {
        pill.firstChild.textContent = '🌊'
        textEl.textContent = '-' + Math.round(progress * seabed) + 'm'
      }
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(update)
      }
    }, { passive: true })
    update()
  }

  /* 伪终端彩蛋：按 ` 呼出，脚本按需加载 */
  function bindTerminalHotkey () {
    var loading = false
    document.addEventListener('keydown', function (e) {
      if (e.key !== '`' || e.ctrlKey || e.altKey || e.metaKey) return
      var target = e.target
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      e.preventDefault()

      if (window.KitchasTerminal) {
        window.KitchasTerminal.toggle()
        return
      }
      if (loading) return
      loading = true
      loadScript('/js/site-terminal.js').then(function () {
        if (window.KitchasTerminal) window.KitchasTerminal.toggle()
      }).catch(function () { loading = false })
    })
  }

  enableNativeLazyLoad()
  bindOptionalFeatures()
  enhanceCodeBlocks()
  initDepthMeter()
  bindTerminalHotkey()

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
