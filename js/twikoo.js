(function () {
  'use strict'

  var TWIKOO_CDN = 'https://cdn.jsdelivr.net/npm/twikoo@1.7.13/dist/twikoo.min.js'

  function loadScript (src) {
    if (typeof window.getScript === 'function') {
      return window.getScript(src)
    }
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) {
        resolve()
        return
      }
      var script = document.createElement('script')
      script.src = src
      script.async = true
      script.onload = resolve
      script.onerror = reject
      document.body.appendChild(script)
    })
  }

  function isConfigured (config) {
    return config && config.envId && config.envId !== 'REPLACE_WITH_ENV_ID'
  }

  function showSetupHint (container) {
    container.innerHTML = '<div class="comment-setup-hint" style="padding:16px;border:1px dashed var(--hr-border);border-radius:8px;line-height:1.8;color:var(--font-color)">' +
      '<strong>评论区尚未完成配置</strong><br>' +
      '1. 打开腾讯云开发控制台，复制<strong>环境 ID</strong>或<strong>云函数 HTTP 访问地址</strong><br>' +
      '2. 填入 <code>/js/comments-config.js</code> 的 <code>envId</code>，并确认 <code>region</code> 与云函数地域一致<br>' +
      '3. push 上线后，访客只需填写昵称即可评论，无需 GitHub 登录' +
      '</div>'
  }

  function initTwikoo (el, path) {
    var config = window.COMMENTS_CONFIG && window.COMMENTS_CONFIG.twikoo
    if (!el || !window.twikoo || !config) return

    if (!isConfigured(config)) {
      showSetupHint(el)
      return
    }

    window.twikoo.init({
      envId: config.envId,
      el: el,
      region: config.region || '',
      path: path || location.pathname,
      lang: config.lang || 'zh-CN',
      onCommentLoaded: function () {
        if (typeof btf !== 'undefined' && btf.loadLightbox) {
          btf.loadLightbox(el.querySelectorAll('.tk-content img:not(.tk-owo-emotion)'))
        }
      }
    })
  }

  function loadTwikoo (el, path) {
    if (typeof window.twikoo === 'object') {
      setTimeout(function () { initTwikoo(el, path) }, 0)
    } else {
      loadScript(TWIKOO_CDN).then(function () {
        initTwikoo(el, path)
      }).catch(function () {
        if (el) {
          el.innerHTML = '<p style="color:var(--font-color)">评论系统加载失败，请稍后重试。</p>'
        }
      })
    }
  }

  window.loadTwikooFor = loadTwikoo

  function bootstrap () {
    var wrap = document.getElementById('twikoo-wrap')
    if (!wrap || !window.COMMENTS_CONFIG) return

    var config = window.COMMENTS_CONFIG.twikoo
    if (!isConfigured(config)) {
      showSetupHint(wrap)
      return
    }

    var start = function () { loadTwikoo(wrap) }
    if (config.lazyload !== false && typeof btf !== 'undefined' && btf.loadComment) {
      btf.loadComment(wrap, start)
    } else {
      start()
    }
  }

  window.twikooTheme = function () {
    var config = window.COMMENTS_CONFIG && window.COMMENTS_CONFIG.twikoo
    if (!config || !isConfigured(config)) return

    var wrap = document.getElementById('twikoo-wrap')
    if (wrap) {
      wrap.innerHTML = ''
      loadTwikoo(wrap)
    }

    document.querySelectorAll('.twikoo-memo-wrap[data-path]').forEach(function (el) {
      var path = el.getAttribute('data-path')
      el.innerHTML = ''
      loadTwikoo(el, path)
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap)
  } else {
    bootstrap()
  }
})()
