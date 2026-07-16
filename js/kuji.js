/* 一番赏：奖池展示、赏券兑换、摇盒抽签、撕券开赏 */
(function () {
  'use strict'

  var app = document.getElementById('kuji-app')
  if (!app) return

  var GRADE_ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
  var state = { pool: null, me: null, drawing: false }

  function bag () { return window.KitchasBag }

  function esc (s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  /* ---------- 页面渲染 ---------- */
  function render () {
    var pool = state.pool
    if (!pool) {
      app.innerHTML = '<p class="kj-loading">一番赏还没开张——奖池服务暂时联系不上，稍后再来试试。</p>'
      return
    }
    var me = pool.me || { coins: 0, tickets: 0 }

    var cards = pool.grades.slice().sort(function (a, b) {
      return GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade)
    }).map(function (g) {
      var sold = g.remaining <= 0
      return '<div class="kj-card kj-g-' + g.grade + (sold ? ' kj-card--sold' : '') + '">' +
        '<span class="kj-stock">剩 ' + g.remaining + '/' + g.total + '</span>' +
        '<span class="kj-award">' + g.grade + '賞</span>' +
        '<div class="kj-emoji">' + g.emoji + '</div>' +
        '<div class="kj-name">' + esc(g.name) + '</div>' +
        '<div class="kj-desc">' + esc(g.desc) + '</div>' +
        '</div>'
    }).join('')

    var lastCard = '<div class="kj-card kj-card--last kj-g-LAST' + (pool.last_one_gone ? ' kj-card--sold' : '') + '">' +
      '<span class="kj-stock">剩 ' + (pool.last_one_gone ? 0 : 1) + '/1</span>' +
      '<span class="kj-award">Last</span>' +
      '<div class="kj-emoji">' + pool.last_prize.emoji + '</div>' +
      '<div class="kj-name">' + esc(pool.last_prize.name) + '</div>' +
      '<div class="kj-desc">' + esc(pool.last_prize.desc) + '</div>' +
      '</div>'

    app.innerHTML =
      '<div class="kj-wallet">' +
      '<span class="kj-wallet__stat">🪙 <b id="kj-coins">' + me.coins + '</b> 金币</span>' +
      '<span class="kj-wallet__stat">🎟️ <b id="kj-tickets">' + me.tickets + '</b> 赏券</span>' +
      '<span class="kj-wallet__btns">' +
      '<button class="kj-btn" id="kj-ex1" type="button">兑换 ×1（' + pool.ticket_price + '🪙）</button>' +
      '<button class="kj-btn" id="kj-ex5" type="button">兑换 ×5</button>' +
      '<button class="kj-btn kj-btn--draw" id="kj-draw" type="button">抽一签！</button>' +
      '</span></div>' +
      '<p class="kj-progress">第 <b>' + pool.season + '</b> 期 · 奖池剩余 <b>' + pool.remaining + '</b> / ' + pool.total +
      ' 签 · 抽走最后一签可获得 Last One 赏</p>' +
      '<div class="kj-grid">' + cards + lastCard + '</div>' +
      '<div class="kj-mine"><h2>🧺 我的赏品</h2><div class="kj-mine-list" id="kj-mine-list">' +
      '<span class="kj-empty">加载中…</span></div></div>'

    document.getElementById('kj-ex1').addEventListener('click', function () { exchange(1, this) })
    document.getElementById('kj-ex5').addEventListener('click', function () { exchange(5, this) })
    document.getElementById('kj-draw').addEventListener('click', startDraw)
    loadMine()
  }

  function loadPool () {
    if (!bag()) return Promise.reject(new Error('backpack missing'))
    return bag().request('GET', '/api/kuji/pool').then(function (d) {
      state.pool = d
    })
  }

  function loadMine () {
    var list = document.getElementById('kj-mine-list')
    if (!list) return
    bag().request('GET', '/api/kuji/mine').then(function (d) {
      if (!d.draws.length) {
        list.innerHTML = '<span class="kj-empty">还没抽过——玩游戏赚金币，兑一张赏券试试手气！</span>'
        return
      }
      list.innerHTML = d.draws.map(function (dr) {
        return '<span class="kj-mine-item">' + dr.emoji + ' <b>' + dr.grade + '賞</b> ' +
          esc(dr.name) + ' <small>#' + String(dr.serial).padStart(2, '0') + '/' + dr.grade_total + '</small>' +
          (dr.is_last_one ? ' 💙Last One' : '') + '</span>'
      }).join('')
    }).catch(function () {
      list.innerHTML = '<span class="kj-empty">加载失败</span>'
    })
  }

  function exchange (count, btn) {
    btn.disabled = true
    bag().request('POST', '/api/kuji/exchange', { count: count }).then(function (d) {
      state.pool.me = { coins: d.coins, tickets: d.tickets }
      document.getElementById('kj-coins').textContent = d.coins
      document.getElementById('kj-tickets').textContent = d.tickets
      bag().toast('🎟️ 兑换成功 ×' + d.exchanged + ' <small>剩 ' + d.coins + ' 金币</small>')
      btn.disabled = false
    }).catch(function (e) {
      bag().toast(esc(e.message || '兑换失败'))
      btn.disabled = false
    })
  }

  /* ---------- 抽赏动画 ---------- */
  var overlay = null

  function ensureOverlay () {
    if (overlay) return
    overlay = document.createElement('div')
    overlay.id = 'kj-overlay'
    document.body.appendChild(overlay)
  }

  function startDraw () {
    if (state.drawing) return
    var me = state.pool && state.pool.me
    if (!me || me.tickets < 1) {
      bag().toast('🎟️ 还没有赏券 <small>先用金币兑换一张吧</small>')
      return
    }
    state.drawing = true

    // 先向服务器抽出结果，动画负责揭晓
    bag().request('POST', '/api/kuji/draw').then(function (result) {
      state.pool = result.pool
      state.pool.me = { coins: result.coins, tickets: result.tickets }
      playAnimation(result)
    }).catch(function (e) {
      state.drawing = false
      bag().toast(esc(e.message || '抽签失败'))
    })
  }

  function playAnimation (result) {
    ensureOverlay()
    overlay.classList.add('kj-open')
    overlay.innerHTML =
      '<div class="kj-stage">' +
      '<button class="kj-stage__close" type="button">✕</button>' +
      '<div class="kj-box-wrap kj-box-wrap--shake">' +
      '<div class="kj-sticks">' +
      '<i class="kj-stick"></i><i class="kj-stick"></i><i class="kj-stick"></i>' +
      '<i class="kj-stick"></i><i class="kj-stick"></i><i class="kj-stick"></i>' +
      '</div>' +
      '<div class="kj-box">' +
      '<span class="kj-box__label">一番賞</span>' +
      '<span class="kj-box__face"><i></i><i></i><u></u><b></b><b></b></span>' +
      '</div></div>' +
      '<div class="kj-eject"></div>' +
      '<div class="kj-stage__hint">咔啦咔啦……</div>' +
      '</div>'

    overlay.querySelector('.kj-stage__close').addEventListener('click', closeOverlay)

    // 摇 1.3s → 弹出签 → 换成待撕赏券
    setTimeout(function () {
      var ej = overlay.querySelector('.kj-eject')
      if (ej) ej.classList.add('kj-eject--go')
    }, 1300)
    setTimeout(function () {
      showTicket(result)
    }, 2350)
  }

  function showTicket (result) {
    var stage = overlay.querySelector('.kj-stage')
    if (!stage) return
    var isBig = result.grade === 'A' || result.grade === 'B' || result.is_last_one

    stage.innerHTML =
      '<button class="kj-stage__close" type="button">✕</button>' +
      '<div class="kj-ticket kj-g-' + result.grade + '">' +
      '<div class="kj-ticket__inner">' +
      '<div class="kj-ticket__grade">' + result.grade + '<small>賞</small></div>' +
      '<div class="kj-ticket__prize-emoji">' + result.emoji + '</div>' +
      '<div class="kj-ticket__prize-name">' + esc(result.name) + '</div>' +
      '<div class="kj-ticket__serial">No.' + String(result.serial).padStart(2, '0') + ' / ' + result.grade_total + '</div>' +
      (result.coin_back ? '<div class="kj-ticket__serial">🪙 已返还 ' + result.coin_back + ' 金币</div>' : '') +
      (result.is_last_one
        ? '<div class="kj-ticket__lastone">💙 ' + esc(result.last_prize.name) + ' 也归你了！</div>'
        : '') +
      '</div>' +
      '<div class="kj-ticket__cover">' +
      '<span class="kj-ticket__cover-kanji">一番賞</span>' +
      '<span class="kj-ticket__cover-tip">👉 按住赏券，向右撕开</span>' +
      '</div></div>' +
      '<div class="kj-result-btns" style="display:none">' +
      '<button class="kj-btn kj-btn--draw" id="kj-again" type="button">再抽一签</button>' +
      '<button class="kj-btn" id="kj-close2" type="button">收下</button>' +
      '</div>'

    stage.querySelector('.kj-stage__close').addEventListener('click', closeOverlay)

    var cover = stage.querySelector('.kj-ticket__cover')
    var torn = false
    var startX = null

    function progressTo (p) {
      // 撕开进度：向右平移 + 轻微上翘，露出内里
      cover.style.transform = 'translateX(' + (p * 55) + '%) rotate(' + (p * 8) + 'deg)'
      cover.style.clipPath = 'inset(0 0 0 ' + (p * 26) + '%)'
      cover.style.opacity = String(1 - p * 0.25)
    }

    function finishTear () {
      if (torn) return
      torn = true
      cover.classList.add('kj-ticket__cover--off')
      var btns = stage.querySelector('.kj-result-btns')
      setTimeout(function () {
        if (btns) btns.style.display = 'flex'
        if (isBig) confetti(stage)
        bindResultBtns(stage)
        state.drawing = false
      }, 480)
    }

    cover.addEventListener('pointerdown', function (e) {
      if (torn) return
      startX = e.clientX
      cover.setPointerCapture(e.pointerId)
      cover.classList.add('kj-ticket__cover--tearing')
    })

    cover.addEventListener('pointermove', function (e) {
      if (torn || startX == null) return
      var p = Math.max(0, Math.min(1, (e.clientX - startX) / 180))
      progressTo(p)
      if (p >= 1) {
        startX = null
        finishTear()
      }
    })

    cover.addEventListener('pointerup', function (e) {
      if (torn || startX == null) return
      var p = Math.max(0, Math.min(1, (e.clientX - startX) / 180))
      startX = null
      if (p >= 0.62) {
        finishTear()
      } else {
        cover.style.transition = 'transform 0.25s ease, clip-path 0.25s ease, opacity 0.25s ease'
        progressTo(0)
        setTimeout(function () { cover.style.transition = '' }, 260)
      }
    })
  }

  function bindResultBtns (stage) {
    var again = stage.querySelector('#kj-again')
    var close2 = stage.querySelector('#kj-close2')
    var me = state.pool.me
    if (again) {
      if (!me || me.tickets < 1 || state.pool.remaining < 1) again.disabled = true
      again.addEventListener('click', function () {
        closeOverlay()
        setTimeout(startDraw, 120)
      })
    }
    if (close2) close2.addEventListener('click', closeOverlay)
  }

  function confetti (stage) {
    var colors = ['#e88989', '#eda963', '#d9bd4f', '#8fc98f', '#74b5d9', '#9d92d9']
    for (var i = 0; i < 36; i++) {
      var c = document.createElement('i')
      c.className = 'kj-confetti'
      c.style.left = (4 + Math.random() * 92) + '%'
      c.style.background = colors[i % colors.length]
      c.style.animationDuration = (1.1 + Math.random() * 1.3) + 's'
      c.style.animationDelay = (Math.random() * 0.5) + 's'
      c.style.transform = 'rotate(' + Math.random() * 360 + 'deg)'
      stage.appendChild(c)
    }
  }

  function closeOverlay () {
    if (overlay) {
      overlay.classList.remove('kj-open')
      overlay.innerHTML = ''
    }
    state.drawing = false
    render()
  }

  /* ---------- 启动 ---------- */
  function boot (attempt) {
    if (!bag()) {
      if ((attempt || 0) < 40) setTimeout(function () { boot((attempt || 0) + 1) }, 100)
      else render()
      return
    }
    loadPool().then(render, function () {
      state.pool = null
      render()
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { boot(0) })
  } else {
    boot(0)
  }
})()
