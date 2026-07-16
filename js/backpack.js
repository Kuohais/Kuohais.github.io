/* 玩家背包：金币、物品、商店、船票恢复码（对接 api.kitchas.cn） */
(function () {
  'use strict'

  var API = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://127.0.0.1:8787'
    : 'https://api.kitchas.cn'

  var KEY_UID = 'kitchas-bag-uid'
  var KEY_TOKEN = 'kitchas-bag-token'

  var state = { profile: null, catalog: null }

  function getToken () {
    try { return localStorage.getItem(KEY_TOKEN) || '' } catch (e) { return '' }
  }

  function saveCreds (uid, token) {
    try {
      localStorage.setItem(KEY_UID, uid)
      localStorage.setItem(KEY_TOKEN, token)
    } catch (e) {}
  }

  function api (method, path, body, withAuth) {
    var headers = { 'Content-Type': 'application/json' }
    if (withAuth) headers['X-Player-Token'] = getToken()
    return fetch(API + path, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) {
          var err = new Error((data && data.detail) || ('HTTP ' + r.status))
          err.status = r.status
          throw err
        }
        return data
      })
    })
  }

  var registering = null
  function ensurePlayer () {
    if (getToken()) return Promise.resolve()
    if (!registering) {
      registering = api('POST', '/api/register').then(function (d) {
        saveCreds(d.uid, d.token)
        registering = null
        if (d.gift_tickets) {
          toast('🎁 新船员见面礼：' + d.gift_tickets + ' 张赏券 <small>去「一番赏」试试手气</small>')
        }
      }, function (e) {
        registering = null
        throw e
      })
    }
    return registering
  }

  function authed (method, path, body) {
    return ensurePlayer().then(function () {
      return api(method, path, body, true)
    }).catch(function (e) {
      // 凭据失效（如服务端重置）：清掉重新注册一次
      if (e && e.status === 401) {
        try {
          localStorage.removeItem(KEY_UID)
          localStorage.removeItem(KEY_TOKEN)
        } catch (err) {}
        return ensurePlayer().then(function () {
          return api(method, path, body, true)
        })
      }
      throw e
    })
  }

  /* ---------- 提示气泡 ---------- */
  function toast (html) {
    var el = document.createElement('div')
    el.className = 'kbag-toast'
    el.innerHTML = html
    document.body.appendChild(el)
    requestAnimationFrame(function () { el.classList.add('kbag-toast--show') })
    setTimeout(function () {
      el.classList.remove('kbag-toast--show')
      setTimeout(function () { el.remove() }, 400)
    }, 2600)
  }

  /* ---------- 对外：游戏上报战绩 ---------- */
  function earn (source, payload) {
    var body = { source: source }
    if (payload) {
      Object.keys(payload).forEach(function (k) { body[k] = payload[k] })
    }
    return authed('POST', '/api/earn', body).then(function (d) {
      if (d.added > 0) {
        toast('🪙 +' + d.added + ' 金币 <small>' + d.reason + ' · 共 ' + d.coins + '</small>')
      } else if (d.today_earned >= d.daily_cap) {
        toast('🪙 今日金币已到上限 <small>明天再来～</small>')
      }
      state.profile = null
      return d
    }).catch(function () {
      return null // 离线/接口未部署时静默
    })
  }

  /* ---------- 背包面板 ---------- */
  var panel = null

  function fetchAll () {
    return Promise.all([
      authed('GET', '/api/me'),
      state.catalog ? Promise.resolve({ catalog: state.catalog }) : api('GET', '/api/catalog')
    ]).then(function (rs) {
      state.profile = rs[0]
      state.catalog = rs[1].catalog
    })
  }

  function esc (s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  function render (tab) {
    if (!panel) return
    var p = state.profile
    var cat = state.catalog || {}
    var body = panel.querySelector('.kbag-panel__body')
    var tabs = panel.querySelector('.kbag-panel__tabs')
    tabs.querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('kbag-tab--on', b.dataset.tab === tab)
    })
    panel.dataset.tab = tab

    if (!p) {
      body.innerHTML = '<p class="kbag-empty">背包服务暂时联系不上（可能还没部署或离线）。</p>'
      return
    }

    var coinsBar = '<div class="kbag-coins">🪙 <b>' + p.coins + '</b>' +
      '<small>今日已赚 ' + p.today_earned + ' / ' + p.daily_cap + '</small></div>'

    if (tab === 'bag') {
      var ids = Object.keys(p.items || {})
      var cells = ids.map(function (id) {
        var it = cat[id] || { emoji: '❔', name: id }
        return '<div class="kbag-item" title="' + esc(it.desc || '') + '">' +
          '<span class="kbag-item__emoji">' + it.emoji + '</span>' +
          '<span class="kbag-item__name">' + esc(it.name) + '</span>' +
          '<span class="kbag-item__qty">×' + p.items[id] + '</span></div>'
      }).join('')
      body.innerHTML = coinsBar +
        (ids.length
          ? '<div class="kbag-grid">' + cells + '</div>'
          : '<p class="kbag-empty">背包还空着——玩游戏赚金币，去「商店」捞点海货吧。</p>')
    } else if (tab === 'shop') {
      var goods = Object.keys(cat).map(function (id) {
        var it = cat[id]
        var afford = p.coins >= it.price
        return '<div class="kbag-item kbag-item--shop">' +
          '<span class="kbag-item__emoji">' + it.emoji + '</span>' +
          '<span class="kbag-item__name">' + esc(it.name) + '</span>' +
          '<span class="kbag-item__desc">' + esc(it.desc) + '</span>' +
          '<button class="kbag-buy" data-buy="' + id + '"' + (afford ? '' : ' disabled') + '>🪙 ' + it.price + '</button>' +
          '</div>'
      }).join('')
      body.innerHTML = coinsBar + '<div class="kbag-grid kbag-grid--shop">' + goods + '</div>'
    } else {
      var uid = ''
      try { uid = localStorage.getItem(KEY_UID) || '' } catch (e) {}
      body.innerHTML =
        '<p class="kbag-note">你的背包默认跟着这台设备走。生成一张<b>船票</b>抄下来，换设备/清缓存后凭它找回背包。</p>' +
        '<div class="kbag-row"><button class="kg-btn" id="kbag-mkcode">🎫 ' +
        (p.has_recovery ? '重新生成船票（旧票作废）' : '生成我的船票') + '</button></div>' +
        '<div class="kbag-code" id="kbag-code"></div>' +
        '<hr class="kbag-hr">' +
        '<p class="kbag-note">已有船票？在这里登船：</p>' +
        '<div class="kbag-row">' +
        '<input class="kbag-input" id="kbag-claim-input" placeholder="KH-XXXX-XXXX-XXXX" spellcheck="false">' +
        '<button class="kg-btn" id="kbag-claim-btn">找回背包</button></div>' +
        '<p class="kbag-note kbag-note--dim">当前水手编号：' + esc(uid) + '</p>'

      body.querySelector('#kbag-mkcode').addEventListener('click', function () {
        var btn = this
        btn.disabled = true
        authed('POST', '/api/recovery/create').then(function (d) {
          var codeEl = body.querySelector('#kbag-code')
          codeEl.innerHTML = '<b>' + d.code + '</b><span>只显示这一次，请立刻抄下来！</span>'
          state.profile.has_recovery = true
          btn.disabled = false
        }).catch(function () {
          btn.disabled = false
          toast('生成失败，稍后再试')
        })
      })

      body.querySelector('#kbag-claim-btn').addEventListener('click', function () {
        var input = body.querySelector('#kbag-claim-input')
        var code = input.value.trim()
        if (!code) return
        api('POST', '/api/recovery/claim', { code: code }).then(function (d) {
          saveCreds(d.uid, d.token)
          state.profile = null
          toast('🎫 登船成功，背包已找回！')
          openPanel('bag')
        }).catch(function (e) {
          toast(esc(e.message || '船票无效'))
        })
      })
    }

    body.querySelectorAll('[data-buy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        btn.disabled = true
        authed('POST', '/api/shop/buy', { item_id: btn.dataset.buy }).then(function (d) {
          state.profile = d
          toast('🛒 入手「' + esc((state.catalog[btn.dataset.buy] || {}).name) + '」')
          render('shop')
        }).catch(function (e) {
          btn.disabled = false
          toast(esc(e.message || '购买失败'))
        })
      })
    })
  }

  function ensurePanel () {
    if (panel) return
    panel = document.createElement('div')
    panel.id = 'kbag-panel-wrap'
    panel.innerHTML =
      '<div class="kbag-mask"></div>' +
      '<div class="kbag-panel">' +
      '<div class="kbag-panel__head"><span>🎒 我的背包</span>' +
      '<button class="kbag-close" type="button" aria-label="关闭">✕</button></div>' +
      '<div class="kbag-panel__tabs">' +
      '<button data-tab="bag" type="button">背包</button>' +
      '<button data-tab="shop" type="button">商店</button>' +
      '<button data-tab="ticket" type="button">船票</button>' +
      '</div>' +
      '<div class="kbag-panel__body"></div>' +
      '</div>'
    document.body.appendChild(panel)
    panel.querySelector('.kbag-mask').addEventListener('click', closePanel)
    panel.querySelector('.kbag-close').addEventListener('click', closePanel)
    panel.querySelector('.kbag-panel__tabs').addEventListener('click', function (e) {
      var b = e.target.closest('button')
      if (b) render(b.dataset.tab)
    })
  }

  function openPanel (tab) {
    ensurePanel()
    panel.classList.add('kbag-open')
    var body = panel.querySelector('.kbag-panel__body')
    body.innerHTML = '<p class="kbag-empty">正在打捞背包…</p>'
    fetchAll().then(function () {
      render(tab || 'bag')
    }, function () {
      state.profile = null
      render(tab || 'bag')
    })
  }

  function closePanel () {
    if (panel) panel.classList.remove('kbag-open')
  }

  /* ---------- 背包入口按钮（游戏厅页面） ---------- */
  function initButton () {
    if (!document.querySelector('.kg-hub__cards')) return
    var btn = document.createElement('button')
    btn.id = 'kbag-fab'
    btn.type = 'button'
    btn.innerHTML = '🎒<span>背包</span>'
    btn.addEventListener('click', function () { openPanel('bag') })
    document.body.appendChild(btn)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initButton)
  } else {
    initButton()
  }

  window.KitchasBag = { earn: earn, open: openPanel, request: authed, publicApi: api, toast: toast }
})()
