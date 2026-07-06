(function () {
  var cfg = window.MEMOS_CONFIG || {}
  var base = String(cfg.baseUrl || 'https://memos.kitchas.cn').replace(/\/$/, '')
  var pageSize = cfg.pageSize || 30

  function escapeHtml (text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function formatTime (value) {
    if (!value) return ''
    var date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleString('zh-CN', { hour12: false })
  }

  function attachmentUrl (attachment) {
    if (!attachment) return ''
    if (attachment.externalLink) return attachment.externalLink
    var name = attachment.name || ''
    var parts = name.split('/')
    var uid = attachment.uid || parts[1]
    var filename = attachment.filename || parts.slice(2).join('/')
    if (!uid || !filename) return ''
    return base + '/file/attachments/' + encodeURIComponent(uid) + '/' + encodeURIComponent(filename)
  }

  function renderContent (text) {
    if (window.marked && typeof window.marked.parse === 'function') {
      return window.marked.parse(text || '', { breaks: true })
    }
    return '<p>' + escapeHtml(text || '').replace(/\n/g, '<br>') + '</p>'
  }

  function renderMemo (memo) {
    var time = formatTime(memo.displayTime || memo.createTime)
    var body = renderContent(memo.content || memo.snippet || '')
    var photos = (memo.attachments || []).map(function (attachment) {
      var src = attachmentUrl(attachment)
      if (!src) return ''
      return (
        '<a class="memos-photo" href="' + src + '" target="_blank" rel="noopener">' +
        '<img src="' + src + '" loading="lazy" alt="">' +
        '</a>'
      )
    }).join('')

    return (
      '<article class="memos-item">' +
      '<time class="memos-time">' + escapeHtml(time) + '</time>' +
      '<div class="memos-body">' + body + '</div>' +
      (photos ? '<div class="memos-photos">' + photos + '</div>' : '') +
      '</article>'
    )
  }

  function showFallback (statusEl, feedEl) {
    statusEl.innerHTML =
      '无法在博客内直接读取 Memos（通常是跨域限制）。已改为嵌入 Memos 公开页。' +
      ' <a href="' + base + '" target="_blank" rel="noopener">打开发文后台</a>'
    feedEl.innerHTML =
      '<iframe class="memos-fallback" title="碎碎念" src="' + base + '" loading="lazy"></iframe>'
  }

  async function loadMemos () {
    var feedEl = document.getElementById('memos-feed')
    var statusEl = document.getElementById('memos-feed-status')
    if (!feedEl || !statusEl) return

    statusEl.textContent = '加载中…'

    try {
      var filter = encodeURIComponent('visibility == "PUBLIC"')
      var url = base + '/api/v1/memos?filter=' + filter +
        '&pageSize=' + pageSize + '&orderBy=' + encodeURIComponent('display_time desc')

      var response = await fetch(url, { credentials: 'omit' })
      if (!response.ok) throw new Error('HTTP ' + response.status)

      var data = await response.json()
      var memos = data.memos || []

      if (!memos.length) {
        statusEl.textContent = '还没有公开的碎碎念。登录 Memos 发一条，并选择「公开」可见性。'
        feedEl.innerHTML = ''
        return
      }

      statusEl.textContent = '共 ' + memos.length + ' 条'
      feedEl.innerHTML = memos.map(renderMemo).join('')
    } catch (error) {
      console.warn('[memos-feed]', error)
      showFallback(statusEl, feedEl)
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadMemos)
  } else {
    loadMemos()
  }
})()
