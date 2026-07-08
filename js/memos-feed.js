(function () {
  'use strict'

  var cfg = window.MEMOS_CONFIG || {}
  var base = String(cfg.baseUrl || 'https://memos.kitchas.cn').replace(/\/$/, '')
  var pageSize = cfg.pageSize || 30
  var authorName = cfg.author || '阔海生'
  var authorAvatar = cfg.avatar || '/img/avatar.png'
  var fallbackUrl = cfg.fallbackUrl || '/data/memos-feed.json'

  function escapeHtml (text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function isLocalHost () {
    return /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
  }

  function fileBase () {
    if (cfg.fileProxy) return String(cfg.fileProxy).replace(/\/$/, '')
    // 图片/视频走 Memos 直链（不受 API 跨域限制）
    return base + '/file'
  }

  function buildApiUrls () {
    var filter = encodeURIComponent('visibility=="PUBLIC"')
    var query = '/v1/memos?filter=' + filter +
      '&pageSize=' + pageSize +
      '&orderBy=' + encodeURIComponent('create_time desc')

    var urls = []
    if (cfg.apiProxy) {
      urls.push(String(cfg.apiProxy).replace(/\/$/, '') + query)
    }
    if (isLocalHost()) {
      urls.push('/memos-api' + query)
    }
    if (fallbackUrl) {
      urls.push(fallbackUrl)
    }
    urls.push(base + '/api' + query)
    return urls.filter(function (url, index, list) {
      return list.indexOf(url) === index
    })
  }

  function memoId (memo) {
    var name = memo.name || ''
    var parts = name.split('/')
    return parts[parts.length - 1] || name
  }

  function formatTime (value) {
    if (!value) return ''
    var date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  function attachmentUrl (attachment) {
    if (!attachment) return ''
    if (attachment.externalLink) return attachment.externalLink

    var fileRoot = fileBase()

    if (attachment.name && attachment.filename) {
      return fileRoot + '/' + attachment.name + '/' + encodeURIComponent(attachment.filename)
    }

    var name = attachment.name || ''
    var parts = name.split('/')
    var uid = attachment.uid || parts[1]
    var filename = attachment.filename || parts.slice(2).join('/')
    if (!uid || !filename) return ''
    return fileRoot + '/attachments/' + encodeURIComponent(uid) + '/' + encodeURIComponent(filename)
  }

  function isImageAttachment (attachment) {
    var type = String(attachment.type || '').toLowerCase()
    if (type.indexOf('image/') === 0) return true
    var filename = String(attachment.filename || '').toLowerCase()
    return /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/.test(filename)
  }

  function renderContent (text) {
    if (window.marked && typeof window.marked.parse === 'function') {
      return window.marked.parse(text || '', { breaks: true })
    }
    return '<p>' + escapeHtml(text || '').replace(/\n/g, '<br>') + '</p>'
  }

  function renderPhotos (attachments) {
    var images = (attachments || []).filter(isImageAttachment).map(function (attachment) {
      var src = attachmentUrl(attachment)
      if (!src) return ''
      return (
        '<a class="memos-photo" href="' + src + '" data-fancybox="memos" rel="noopener">' +
        '<img src="' + src + '" loading="lazy" alt="">' +
        '</a>'
      )
    }).filter(Boolean)

    if (!images.length) return ''
    var gridClass = images.length === 1 ? 'memos-photos memos-photos--single' : 'memos-photos'
    return '<div class="' + gridClass + '">' + images.join('') + '</div>'
  }

  function renderComments (id) {
    return (
      '<div class="memos-comments">' +
      '<div class="comment-head">' +
      '<span class="comment-headline"><i class="fas fa-comments fa-fw"></i> 评论</span>' +
      '</div>' +
      '<div class="comment-wrap">' +
      '<div class="twikoo-memo-wrap" data-path="/moments/' + escapeHtml(id) + '/"></div>' +
      '</div>' +
      '</div>'
    )
  }

  function renderMemo (memo) {
    var id = memoId(memo)
    var time = formatTime(memo.displayTime || memo.createTime || memo.updateTime)
    var body = renderContent(memo.content || memo.snippet || '')
    var photos = renderPhotos(memo.attachments)

    return (
      '<article class="memos-item" id="memo-' + escapeHtml(id) + '">' +
      '<header class="memos-header">' +
      '<img class="memos-avatar" src="' + escapeHtml(authorAvatar) + '" alt="' + escapeHtml(authorName) + '" loading="lazy">' +
      '<div class="memos-meta">' +
      '<span class="memos-author">' + escapeHtml(authorName) + '</span>' +
      '<time class="memos-time" datetime="' + escapeHtml(memo.createTime || '') + '">' +
      escapeHtml(time) +
      '</time>' +
      '</div>' +
      '</header>' +
      '<div class="memos-content">' +
      '<div class="memos-body">' + body + '</div>' +
      photos +
      renderComments(id) +
      '</div>' +
      '</article>'
    )
  }

  function initComments () {
    if (typeof window.loadTwikooFor !== 'function') return
    document.querySelectorAll('.twikoo-memo-wrap[data-path]').forEach(function (wrap) {
      window.loadTwikooFor(wrap, wrap.getAttribute('data-path'))
    })
  }

  function showError (feedEl, message) {
    feedEl.innerHTML =
      '<p class="memos-error">' + escapeHtml(message) + '</p>'
  }

  function normalizeMemos (data) {
    return (data.memos || []).filter(function (memo) {
      return memo.visibility === 'PUBLIC' && memo.state !== 'ARCHIVED'
    })
  }

  async function fetchMemosData () {
    var urls = buildApiUrls()
    var lastError = null

    for (var i = 0; i < urls.length; i++) {
      try {
        var response = await fetch(urls[i], { credentials: 'omit' })
        if (!response.ok) {
          throw new Error('HTTP ' + response.status + ' @ ' + urls[i])
        }
        var data = await response.json()
        var memos = normalizeMemos(data)
        if (!memos.length && urls[i] !== fallbackUrl) {
          throw new Error('empty @ ' + urls[i])
        }
        return { memos: memos, source: urls[i] }
      } catch (error) {
        lastError = error
        console.warn('[memos-feed] source failed:', urls[i], error)
      }
    }

    throw lastError || new Error('all sources failed')
  }

  async function loadMemos () {
    var feedEl = document.getElementById('memos-feed')
    if (!feedEl) return

    feedEl.innerHTML = '<p class="memos-loading"><i class="fas fa-spinner fa-pulse"></i> 加载中…</p>'

    try {
      var result = await fetchMemosData()
      var memos = result.memos

      if (!memos.length) {
        feedEl.innerHTML = '<p class="memos-empty">暂无碎碎念</p>'
        return
      }

      feedEl.innerHTML = memos.map(renderMemo).join('')
      initComments()

      if (typeof btf !== 'undefined' && btf.loadLightbox) {
        btf.loadLightbox(document.querySelectorAll('.memos-photo img'))
      }
    } catch (error) {
      console.warn('[memos-feed]', error)
      showError(
        feedEl,
        '碎碎念加载失败。本地预览请使用 scripts/serve.ps1 启动；线上部署请在 Memos 的 Nginx 配置 CORS，或运行 scripts/sync-memos.ps1 更新缓存。'
      )
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadMemos)
  } else {
    loadMemos()
  }
})()
