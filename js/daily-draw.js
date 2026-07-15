(function () {
  'use strict'

  var KEY_UID = 'kitchas-draw-uid'
  var KEY_LAST = 'kitchas-draw-last'

  var LEVELS = [
    {
      name: '大吉', weight: 18, color: '#f2994a',
      poems: [
        '风正帆悬，此行必有好消息。',
        '海上生明月，心想之事渐次成真。',
        '潮水正涨，放手去做便是。',
        '灯塔长明，贵人就在不远处。'
      ]
    },
    {
      name: '中吉', weight: 26, color: '#49b1f5',
      poems: [
        '风向正好，适合把想法付诸行动。',
        '浪花温柔，小事顺遂，积少成多。',
        '云开雾散，远处已隐约有帆。',
        '顺流而行，不必事事用力。'
      ]
    },
    {
      name: '小吉', weight: 26, color: '#3aa3e0',
      poems: [
        '贝壳藏珠，耐心自有回响。',
        '微风轻浪，宜稳步慢行。',
        '潮退之后，沙滩上总能捡到点什么。',
        '小小的好运，正在路上。'
      ]
    },
    {
      name: '平', weight: 20, color: '#45a29e',
      poems: [
        '风平浪静，平安即是福。',
        '今日无浪，适合靠岸休整。',
        '海面如镜，心静则明。',
        '不进不退，也是一种前行。'
      ]
    },
    {
      name: '末吉', weight: 10, color: '#8e9aaf',
      poems: [
        '暂时逆风，收帆等潮也是智慧。',
        '深海无声，沉住气便是赢。',
        '雾会散的，先照顾好自己。',
        '慢一点没关系，海不会跑。'
      ]
    }
  ]

  var YI_POOL = [
    '早睡', '散步', '给旧友发条消息', '整理桌面', '喝热茶', '写点东西',
    '拍一张天空', '吃顿好的', '听老歌', '晒太阳', '读几页书', '存一笔小钱'
  ]
  var JI_POOL = [
    '熬夜', '内耗', '空腹喝咖啡', '冲动购物', '与人争执',
    '久坐不动', '想太多', '拖延', '翻旧账', '赖床过头'
  ]

  var BOTTLE_SVG =
    '<svg class="kitchas-draw__bottle" viewBox="0 0 72 72" aria-hidden="true">' +
    '<g transform="rotate(18 36 36)">' +
    '<rect x="30" y="3" width="12" height="9" rx="2.5" fill="#c08a52"/>' +
    '<rect x="28.5" y="11" width="15" height="5" rx="2" fill="#9fceea"/>' +
    '<path d="M28 15 h16 v5 c7 5 9 11 9 18 v12 a9 9 0 0 1 -9 9 h-16 a9 9 0 0 1 -9 -9 v-12 c0 -7 2 -13 9 -18 z" ' +
    'fill="rgba(214,238,252,0.85)" stroke="rgba(110,175,215,0.95)" stroke-width="2"/>' +
    '<rect x="31" y="33" width="11" height="18" rx="2.5" fill="#fff6dc" stroke="#e3cd96" stroke-width="1.5" transform="rotate(-8 36 42)"/>' +
    '<path d="M25 24 c-3 4 -4 8 -4 12" stroke="rgba(255,255,255,0.9)" stroke-width="2.5" fill="none" stroke-linecap="round"/>' +
    '</g></svg>'

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  function getBeijingDate () {
    var now = new Date()
    var utc = now.getTime() + now.getTimezoneOffset() * 60000
    return new Date(utc + 8 * 3600000)
  }

  function dateKey (date) {
    return date.getFullYear() + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0')
  }

  function hashSeed (str) {
    var h = 0
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i)
      h |= 0
    }
    return Math.abs(h)
  }

  function createRng (seed) {
    var s = seed || 1
    return function () {
      s = (s * 1103515245 + 12345) & 0x7fffffff
      return s / 0x7fffffff
    }
  }

  function getUid () {
    var uid = null
    try { uid = localStorage.getItem(KEY_UID) } catch (e) {}
    if (!uid) {
      uid = String(Math.floor(Math.random() * 1e9))
      try { localStorage.setItem(KEY_UID, uid) } catch (e) {}
    }
    return uid
  }

  function savedToday () {
    var today = dateKey(getBeijingDate())
    try {
      var saved = JSON.parse(localStorage.getItem(KEY_LAST) || 'null')
      if (saved && saved.date === today && saved.level) return saved
    } catch (e) {}
    return null
  }

  function pickWeighted (rng, list) {
    var total = 0
    for (var i = 0; i < list.length; i++) total += list[i].weight
    var r = rng() * total
    for (var j = 0; j < list.length; j++) {
      r -= list[j].weight
      if (r < 0) return list[j]
    }
    return list[list.length - 1]
  }

  function pickDistinct (rng, pool, n) {
    var copy = pool.slice()
    var out = []
    while (out.length < n && copy.length) {
      out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0])
    }
    return out
  }

  function drawToday () {
    var today = dateKey(getBeijingDate())
    var rng = createRng(hashSeed(today + '#' + getUid()))
    var level = pickWeighted(rng, LEVELS)
    var result = {
      date: today,
      level: level.name,
      color: level.color,
      poem: level.poems[Math.floor(rng() * level.poems.length)],
      yi: pickDistinct(rng, YI_POOL, 2),
      ji: pickDistinct(rng, JI_POOL, 2)
    }
    try { localStorage.setItem(KEY_LAST, JSON.stringify(result)) } catch (e) {}
    return result
  }

  function chips (items) {
    var html = ''
    for (var i = 0; i < items.length; i++) {
      html += '<span class="kitchas-draw-card__chip">' + items[i] + '</span>'
    }
    return html
  }

  function spawnRiseBubbles (overlay) {
    if (reduceMotion) return
    for (var i = 0; i < 12; i++) {
      var b = document.createElement('span')
      b.className = 'kitchas-draw-rise'
      var size = 6 + Math.random() * 18
      b.style.width = size + 'px'
      b.style.height = size + 'px'
      b.style.left = (Math.random() * 100) + '%'
      b.style.animationDuration = (2.8 + Math.random() * 2.6) + 's'
      b.style.animationDelay = (Math.random() * 0.9) + 's'
      overlay.appendChild(b)
    }
  }

  function openModal (result, isRepeat) {
    var old = document.getElementById('kitchas-draw-overlay')
    if (old) old.remove()

    var overlay = document.createElement('div')
    overlay.id = 'kitchas-draw-overlay'

    var dateText = result.date.replace(/-/g, '.')
    overlay.innerHTML =
      '<div class="kitchas-draw-card" role="dialog" aria-modal="true" aria-label="今日运势">' +
      '<button class="kitchas-draw-card__close" type="button" aria-label="关闭">&times;</button>' +
      '<div class="kitchas-draw-card__kicker">' +
      (isRepeat ? '今天已经抽过啦，这是你的签' : '你捞起了一只漂流瓶') +
      '</div>' +
      '<div class="kitchas-draw-card__level" style="color:' + result.color + '">' + result.level + '</div>' +
      '<div class="kitchas-draw-card__poem">' + result.poem + '</div>' +
      '<div class="kitchas-draw-card__row kitchas-draw-card__row--yi">' +
      '<span class="kitchas-draw-card__tag">宜</span>' + chips(result.yi) + '</div>' +
      '<div class="kitchas-draw-card__row kitchas-draw-card__row--ji">' +
      '<span class="kitchas-draw-card__tag">忌</span>' + chips(result.ji) + '</div>' +
      '<div class="kitchas-draw-card__foot">' + dateText + ' · 每日一签 · 明天再来</div>' +
      '</div>'

    document.body.appendChild(overlay)
    spawnRiseBubbles(overlay)

    function close () {
      overlay.classList.remove('kitchas-draw-overlay--show')
      document.removeEventListener('keydown', onKey)
      setTimeout(function () { overlay.remove() }, 260)
    }

    function onKey (e) {
      if (e.key === 'Escape') close()
    }

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close()
    })
    overlay.querySelector('.kitchas-draw-card__close').addEventListener('click', close)
    document.addEventListener('keydown', onKey)

    requestAnimationFrame(function () {
      overlay.classList.add('kitchas-draw-overlay--show')
    })
  }

  function setDone (btn, result) {
    btn.classList.remove('kitchas-draw--pending')
    btn.classList.add('kitchas-draw--done')
    var label = btn.querySelector('.kitchas-draw__label')
    if (label) label.textContent = '今日 · ' + result.level
  }

  function init () {
    var header = document.getElementById('page-header')
    if (!header || !header.classList.contains('kitchas-banner')) return

    var btn = document.createElement('button')
    btn.id = 'kitchas-daily-draw'
    btn.type = 'button'
    btn.className = 'kitchas-draw--pending'
    btn.setAttribute('aria-label', '每日一抽：捞起漂流瓶')
    btn.innerHTML = BOTTLE_SVG +
      '<span class="kitchas-draw__label">每日一抽</span>' +
      '<span class="kitchas-draw__bubble"></span>' +
      '<span class="kitchas-draw__bubble"></span>' +
      '<span class="kitchas-draw__bubble"></span>'
    header.appendChild(btn)

    var existing = savedToday()
    if (existing) setDone(btn, existing)

    var busy = false
    btn.addEventListener('click', function () {
      if (busy) return
      var saved = savedToday()
      if (saved) {
        openModal(saved, true)
        return
      }
      busy = true
      btn.classList.add('kitchas-draw--shaking')
      var delay = reduceMotion ? 0 : 720
      setTimeout(function () {
        btn.classList.remove('kitchas-draw--shaking')
        var result = drawToday()
        setDone(btn, result)
        openModal(result, false)
        busy = false
      }, delay)
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
