/* 深海回声：每日声呐寻宝解谜（由 hub.js 按需加载） */
(function () {
  'use strict'

  window.KitchasGames = window.KitchasGames || {}

  var SIZE = 8
  var MAX_PINGS = 7
  var DAILY_KEY_PREFIX = 'kitchas-sonar-'
  var TUTORIAL_KEY = 'kitchas-sonar-tutorial'

  var refs = null

  function beijingDateKey () {
    var now = new Date()
    var bj = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 8 * 3600000)
    return bj.getFullYear() + '-' +
      String(bj.getMonth() + 1).padStart(2, '0') + '-' +
      String(bj.getDate()).padStart(2, '0')
  }

  function hashSeed (str) {
    var h = 0
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i)
      h |= 0
    }
    return Math.abs(h) || 1
  }

  function createRng (seed) {
    var s = seed
    return function () {
      s = (s * 1103515245 + 12345) & 0x7fffffff
      return s / 0x7fffffff
    }
  }

  function chebyshev (a, b) {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
  }

  function heatColor (d) {
    // 0 最热 → 7 最冷
    var stops = [
      'rgba(235, 87, 87, 0.75)',
      'rgba(242, 153, 74, 0.68)',
      'rgba(242, 201, 76, 0.5)',
      'rgba(160, 190, 120, 0.4)',
      'rgba(110, 170, 190, 0.34)',
      'rgba(86, 140, 190, 0.3)',
      'rgba(70, 110, 170, 0.26)',
      'rgba(60, 85, 140, 0.22)'
    ]
    return stops[Math.min(d, stops.length - 1)]
  }

  function loadDaily (key) {
    try { return JSON.parse(localStorage.getItem(DAILY_KEY_PREFIX + key) || 'null') } catch (e) { return null }
  }

  function saveDaily (key, result) {
    try { localStorage.setItem(DAILY_KEY_PREFIX + key, JSON.stringify(result)) } catch (e) {}
  }

  function start (stage) {
    stop()
    refs = { stage: stage }
    var dateKey = beijingDateKey()
    var played = loadDaily(dateKey)
    newGame(stage, 'daily', dateKey, played)
  }

  function newGame (stage, mode, dateKey, played) {
    stage.innerHTML = ''

    var seed = mode === 'daily'
      ? hashSeed('sonar#' + dateKey)
      : hashSeed('practice#' + Date.now() + '#' + Math.random())
    var rng = createRng(seed)

    var treasure = { x: Math.floor(rng() * SIZE), y: Math.floor(rng() * SIZE) }
    var whale
    do {
      whale = { x: Math.floor(rng() * SIZE), y: Math.floor(rng() * SIZE) }
    } while (chebyshev(whale, treasure) < 2)

    var st = {
      mode: mode,
      dateKey: dateKey,
      treasure: treasure,
      whale: whale,
      rng: rng,
      pingsLeft: MAX_PINGS,
      diveMode: false,
      finished: !!played,
      history: []
    }

    var root = document.createElement('div')
    root.className = 'kg-sonar'
    root.innerHTML =
      '<div class="kg-sonar__head">' +
      '<span>' + (mode === 'daily' ? '今日海图 <b>' + dateKey + '</b>' : '练习海图') + '</span>' +
      '<span>声呐 <b id="kg-pings">' + MAX_PINGS + '</b> 次</span>' +
      '<span>潜水钟 <b>1</b> 次</span>' +
      '</div>' +
      '<p class="kg-sonar__rules">目标：找出宝船 ⚓ 藏在哪一格，用潜水钟捞它。' +
      '数字 = 该格到最近回声源的格数（斜向也算 1 格，0 = 就在此格）。</p>' +
      '<div class="kg-sonar__grid" id="kg-grid"></div>' +
      '<div class="kg-sonar__actions">' +
      '<button class="kg-btn kg-btn--ghost" id="kg-dive-btn" type="button">🔔 投放潜水钟</button>' +
      '<button class="kg-btn kg-btn--ghost" id="kg-rules-btn" type="button">❓ 玩法</button>' +
      (mode === 'daily'
        ? '<button class="kg-btn kg-btn--ghost" id="kg-practice-btn" type="button">🎲 练习模式</button>'
        : '<button class="kg-btn kg-btn--ghost" id="kg-daily-btn" type="button">📅 回到今日海图</button>') +
      '</div>' +
      '<div class="kg-sonar__msg" id="kg-msg"></div>'
    stage.appendChild(root)

    /* ---------- 玩法教程 ---------- */
    function showTutorial () {
      var old = stage.querySelector('.kg-panel')
      if (old) old.remove()
      var el = document.createElement('div')
      el.className = 'kg-panel kg-panel--rules'
      el.innerHTML =
        '<h3>📡 深海回声 · 玩法</h3>' +
        '<ol class="kg-rules-steps">' +
        '<li><b>目标</b>：8×8 海域某格沉着宝船 ⚓，把唯一的潜水钟投在它头上就赢。</li>' +
        '<li><b>探测</b>：点击格子发射声呐（共 ' + MAX_PINGS + ' 次），格子显示一个<b>数字</b> = 这格到最近回声源隔了几格（横、竖、斜都算 1 格，<b>0 = 就在这格</b>）。</li>' +
        '<li><b>干扰</b>：海里还有一头鲸 🐋 也会反射回声！它每听到一次声呐就游 1 格，而宝船永远不动。</li>' +
        '<li><b>技巧</b>：同一片海域探两次，数字变了 → 那边是鲸；数字稳定 → 宝船可能就在附近。</li>' +
        '<li><b>决胜</b>：想好后点「🔔 投放潜水钟」，再点你认定的格子。机会只有一次！</li>' +
        '</ol>' +
        '<div class="kg-panel__btns"><button class="kg-btn" id="kg-rules-ok">明白了，开始探测</button></div>'
      stage.appendChild(el)
      el.querySelector('#kg-rules-ok').addEventListener('click', function () {
        el.remove()
        try { localStorage.setItem(TUTORIAL_KEY, '1') } catch (e) {}
      })
    }

    root.querySelector('#kg-rules-btn').addEventListener('click', showTutorial)

    var seenTutorial = false
    try { seenTutorial = localStorage.getItem(TUTORIAL_KEY) === '1' } catch (e) {}
    if (!seenTutorial && !played) showTutorial()

    var grid = root.querySelector('#kg-grid')
    var msg = root.querySelector('#kg-msg')
    var pingsEl = root.querySelector('#kg-pings')
    var diveBtn = root.querySelector('#kg-dive-btn')

    var cells = []
    for (var y = 0; y < SIZE; y++) {
      for (var x = 0; x < SIZE; x++) {
        var cell = document.createElement('button')
        cell.type = 'button'
        cell.className = 'kg-sonar__cell'
        cell.dataset.x = x
        cell.dataset.y = y
        grid.appendChild(cell)
        cells.push(cell)
      }
    }

    function cellAt (x, y) { return cells[y * SIZE + x] }

    function setMsg (text) { msg.textContent = text }

    function moveWhale () {
      var dirs = []
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue
          var nx = st.whale.x + dx
          var ny = st.whale.y + dy
          if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue
          if (nx === st.treasure.x && ny === st.treasure.y) continue
          dirs.push({ x: nx, y: ny })
        }
      }
      if (dirs.length) st.whale = dirs[Math.floor(st.rng() * dirs.length)]
    }

    function ring (cell) {
      var r = document.createElement('span')
      r.className = 'kg-sonar__ring'
      cell.appendChild(r)
      setTimeout(function () { r.remove() }, 750)
    }

    function ping (x, y) {
      if (st.pingsLeft <= 0) {
        setMsg('声呐耗尽了——只能凭直觉投放潜水钟！')
        return
      }
      st.pingsLeft--
      pingsEl.textContent = st.pingsLeft

      var pos = { x: x, y: y }
      var d = Math.min(chebyshev(pos, st.treasure), chebyshev(pos, st.whale))
      var cell = cellAt(x, y)
      ring(cell)
      cell.textContent = d
      cell.classList.add('kg-cell--ping')
      cell.style.setProperty('--kg-heat', heatColor(d))
      st.history.push({ x: x, y: y, d: d })

      moveWhale()

      if (d === 0) setMsg('0 = 目标就在这格！……但它是不动的宝船，还是刚好游过的鲸？')
      else if (st.pingsLeft === 0) setMsg('声呐耗尽，点「🔔 投放潜水钟」做最终判断吧！')
      else if (st.history.length === 1) setMsg('数字 ' + d + ' = 最近的目标离这格 ' + d + ' 格远（注意：鲸听到声呐游动了一格）')
      else setMsg('回声距离 ' + d + '（鲸又悄悄游动了一格）')
    }

    function finish (win, diveCell) {
      st.finished = true
      st.diveMode = false
      cells.forEach(function (c) { c.disabled = true })

      var tCell = cellAt(st.treasure.x, st.treasure.y)
      tCell.textContent = '⚓'
      tCell.classList.add('kg-cell--treasure')
      var wCell = cellAt(st.whale.x, st.whale.y)
      if (wCell !== tCell) {
        wCell.textContent = '🐋'
        wCell.classList.add('kg-cell--whale')
      }
      if (diveCell) diveCell.classList.add(win ? 'kg-cell--dive-win' : 'kg-cell--dive-miss')

      var used = MAX_PINGS - st.pingsLeft
      if (st.mode === 'daily') {
        saveDaily(st.dateKey, { win: win, pings: used })
      }

      var actions = root.querySelector('.kg-sonar__actions')
      diveBtn.remove()
      var shareBtn = document.createElement('button')
      shareBtn.className = 'kg-btn'
      shareBtn.type = 'button'
      shareBtn.textContent = '复制战绩'
      actions.insertBefore(shareBtn, actions.firstChild)
      shareBtn.addEventListener('click', function () {
        var text = '深海回声 ' + (st.mode === 'daily' ? st.dateKey : '练习') + ' ' +
          (win ? '✅ ' + used + '📡 就捞到宝船' : '❌ 宝船逃过一劫') +
          ' — 来试试你的声呐：https://kitchas.cn/game/#sonar'
        function done (ok) {
          shareBtn.textContent = ok ? '已复制' : '复制失败'
          setTimeout(function () { shareBtn.textContent = '复制战绩' }, 1500)
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { done(true) }, function () { done(false) })
        } else done(false)
      })

      setMsg(win
        ? '🎉 潜水钟正中宝船！用了 ' + used + ' 次声呐。' +
          (st.mode === 'daily' ? '明天有新的海图。' : '')
        : '💨 潜水钟落空了……宝船在 ⚓ 处，鲸在 🐋 处。' +
          (st.mode === 'daily' ? '明天再来！' : ''))
    }

    grid.addEventListener('click', function (e) {
      if (st.finished) return
      var cell = e.target.closest('.kg-sonar__cell')
      if (!cell) return
      var x = parseInt(cell.dataset.x, 10)
      var y = parseInt(cell.dataset.y, 10)

      if (st.diveMode) {
        var win = x === st.treasure.x && y === st.treasure.y
        finish(win, cell)
      } else {
        ping(x, y)
      }
    })

    diveBtn.addEventListener('click', function () {
      if (st.finished) return
      st.diveMode = !st.diveMode
      diveBtn.classList.toggle('kg-btn--armed', st.diveMode)
      setMsg(st.diveMode
        ? '潜水钟已就位——点击你认定的格子，机会只有一次！'
        : '已切回声呐模式。')
    })

    var practiceBtn = root.querySelector('#kg-practice-btn')
    if (practiceBtn) {
      practiceBtn.addEventListener('click', function () {
        newGame(stage, 'practice', dateKey, null)
      })
    }
    var dailyBtn = root.querySelector('#kg-daily-btn')
    if (dailyBtn) {
      dailyBtn.addEventListener('click', function () {
        newGame(stage, 'daily', beijingDateKey(), loadDaily(beijingDateKey()))
      })
    }

    if (played) {
      cells.forEach(function (c) { c.disabled = true })
      diveBtn.disabled = true
      setMsg((played.win
        ? '今天已捞到宝船（' + played.pings + ' 次声呐）✅'
        : '今天的潜水钟已经用掉了 ❌') + ' 明天再来，或玩练习模式。')
    } else {
      setMsg('点击海域格子发射声呐 📡')
    }
  }

  function stop () {
    if (refs && refs.stage) refs.stage.innerHTML = ''
    refs = null
  }

  window.KitchasGames.sonar = { start: start, stop: stop }
})()
