/* 深潜者：无尽下潜小游戏（由 hub.js 按需加载） */
(function () {
  'use strict'

  window.KitchasGames = window.KitchasGames || {}

  var BEST_KEY = 'kitchas-diver-best'
  var PX_PER_M = 46

  var refs = null // { stage, canvas, ctx, hud, panel, raf, listeners }

  function clamp (v, min, max) { return v < min ? min : (v > max ? max : v) }

  function getBest () {
    var v = 0
    try { v = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0 } catch (e) {}
    return v
  }

  function setBest (v) {
    try { localStorage.setItem(BEST_KEY, String(v)) } catch (e) {}
  }

  function start (stage) {
    stop()

    var canvas = document.createElement('canvas')
    canvas.className = 'kg-diver-canvas'
    stage.appendChild(canvas)

    var hud = document.createElement('div')
    hud.className = 'kg-diver-hud'
    hud.innerHTML =
      '<span class="kg-diver-hud__depth" id="kg-depth">-0m</span>' +
      '<span class="kg-diver-hud__best" id="kg-best"></span>' +
      '<span class="kg-o2">O₂<span class="kg-o2__bar"><span class="kg-o2__fill" id="kg-o2"></span></span></span>'
    stage.appendChild(hud)

    var st = {
      phase: 'ready',
      w: 0,
      h: 0,
      dpr: 1,
      cameraY: 0,
      speed: 105,
      diver: { x: 0, y: 0, r: 15, tx: 0, ty: 0, tilt: 0 },
      o2: 100,
      invulnUntil: 0,
      hitFlash: 0,
      entities: [],
      trail: [],
      spawnAt: 0,
      nextHunterAt: 0,
      wallSeed: 0,
      lastT: 0,
      keys: {},
      depth: 0
    }

    refs = {
      stage: stage,
      canvas: canvas,
      ctx: canvas.getContext('2d'),
      hud: hud,
      panel: null,
      raf: 0,
      st: st,
      listeners: []
    }

    function on (target, ev, fn, opts) {
      target.addEventListener(ev, fn, opts)
      refs.listeners.push([target, ev, fn])
    }

    function resize () {
      var rect = stage.getBoundingClientRect()
      st.w = Math.max(1, rect.width)
      st.h = Math.max(1, rect.height)
      st.dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(st.w * st.dpr)
      canvas.height = Math.floor(st.h * st.dpr)
    }
    resize()
    on(window, 'resize', resize)

    st.diver.x = st.diver.tx = st.w / 2
    st.diver.y = st.diver.ty = st.h * 0.32

    function pointerTo (e) {
      var rect = canvas.getBoundingClientRect()
      st.diver.tx = clamp(e.clientX - rect.left, 24, st.w - 24)
      st.diver.ty = clamp(e.clientY - rect.top, 60, st.h * 0.72)
    }

    on(canvas, 'pointermove', function (e) {
      if (st.phase === 'play') pointerTo(e)
    }, { passive: true })
    on(canvas, 'pointerdown', function (e) {
      if (st.phase === 'play') pointerTo(e)
    }, { passive: true })
    on(window, 'keydown', function (e) {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].indexOf(e.key) !== -1) e.preventDefault()
      st.keys[e.key] = true
    })
    on(window, 'keyup', function (e) { st.keys[e.key] = false })

    showIntro()
    refs.raf = requestAnimationFrame(loop)

    /* ---------- 面板 ---------- */
    function panel (html) {
      closePanel()
      var el = document.createElement('div')
      el.className = 'kg-panel'
      el.innerHTML = html
      stage.appendChild(el)
      refs.panel = el
      return el
    }

    function closePanel () {
      if (refs.panel) { refs.panel.remove(); refs.panel = null }
    }

    function showIntro () {
      var el = panel(
        '<h3>🤿 深潜者</h3>' +
        '<p>移动鼠标或拖动手指，控制潜水员下潜。</p>' +
        '<p>躲开 <b>水母</b>、<b>暗礁</b> 与收窄的 <b>海沟岩壁</b>，捡 <b>气泡</b> 补充氧气。' +
        '<br>深处不仅更黑更快，还有被灯光吸引来的 <b>猎食者</b>……</p>' +
        '<p style="opacity:.7">历史最深：-' + getBest() + 'm</p>' +
        '<div class="kg-panel__btns"><button class="kg-btn" id="kg-go">开始下潜</button></div>'
      )
      el.querySelector('#kg-go').addEventListener('click', beginRun)
    }

    function beginRun () {
      closePanel()
      st.phase = 'play'
      st.cameraY = 0
      st.speed = 105
      st.o2 = 100
      st.depth = 0
      st.entities = []
      st.trail = []
      st.hitFlash = 0
      st.invulnUntil = 0
      st.spawnAt = 0
      st.nextHunterAt = 9000 + Math.random() * 4000
      st.wallSeed = Math.random() * 1000
      st.diver.x = st.diver.tx = st.w / 2
      st.diver.y = st.diver.ty = st.h * 0.32
    }

    /* ---------- 海沟岩壁 ---------- */
    // 30m 后两侧岩壁出现并随深度收窄，通道中心随深度蜿蜒
    function wallGap (worldY) {
      var depth = worldY / PX_PER_M
      var open = clamp((depth - 30) / 70, 0, 1)
      if (open <= 0) return null
      var half = st.w * (0.5 - 0.30 * open * clamp(depth / 260, 0.35, 1))
      half = Math.max(half, 74)
      var center = st.w / 2 +
        Math.sin(worldY / 470 + st.wallSeed) * st.w * 0.2 * open +
        Math.sin(worldY / 173 + st.wallSeed * 2.7) * st.w * 0.07 * open
      center = clamp(center, half + 6, st.w - half - 6)
      return { center: center, half: half }
    }

    function gameOver () {
      st.phase = 'over'
      var depth = Math.floor(st.depth)
      var best = getBest()
      var isNew = depth > best
      if (isNew) { setBest(depth); best = depth }

      if (window.KitchasBag && depth > 0) {
        window.KitchasBag.earn('diver', { depth: depth })
      }

      var el = panel(
        '<h3>' + (isNew ? '🏆 新纪录！' : '🫧 氧气耗尽') + '</h3>' +
        '<p class="kg-panel__big">-' + depth + 'm</p>' +
        '<p>历史最深：-' + best + 'm</p>' +
        '<div class="kg-panel__btns">' +
        '<button class="kg-btn" id="kg-again">再潜一次</button>' +
        '<button class="kg-btn kg-btn--ghost" id="kg-share">复制战绩</button>' +
        '</div>'
      )
      el.querySelector('#kg-again').addEventListener('click', beginRun)
      el.querySelector('#kg-share').addEventListener('click', function () {
        var btn = this
        var text = '我在「阔海生与海」潜到了 -' + depth + 'm 🤿 来比比谁潜得深：https://kitchas.cn/game/#diver'
        function done (ok) {
          btn.textContent = ok ? '已复制' : '复制失败'
          setTimeout(function () { btn.textContent = '复制战绩' }, 1500)
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { done(true) }, function () { done(false) })
        } else done(false)
      })
    }

    /* ---------- 生成实体 ---------- */
    function laneAt (worldY) {
      var gap = wallGap(worldY)
      if (gap) return { min: gap.center - gap.half + 26, max: gap.center + gap.half - 26 }
      return { min: 30, max: st.w - 30 }
    }

    function spawn (now) {
      var depth = st.depth
      var interval = clamp(820 - depth * 2.0, 300, 820)
      if (now < st.spawnAt) return
      st.spawnAt = now + interval

      var r = Math.random()
      var worldY = st.cameraY + st.h + 60
      var lane = laneAt(worldY)
      var span = Math.max(40, lane.max - lane.min)
      var bubbleP = depth < 80 ? 0.4 : (depth < 220 ? 0.32 : 0.26)

      if (r < bubbleP) {
        st.entities.push({
          type: 'bubble',
          x: lane.min + Math.random() * span,
          worldY: worldY,
          r: 9 + Math.random() * 5,
          rise: 26 + Math.random() * 22,
          sway: Math.random() * Math.PI * 2
        })
      } else if (r < bubbleP + 0.34) {
        var jCount = depth > 160 && Math.random() < 0.45 ? 2 : 1
        for (var jj = 0; jj < jCount; jj++) {
          st.entities.push({
            type: 'jelly',
            x: lane.min + Math.random() * span,
            worldY: worldY + Math.random() * 140,
            r: 15 + Math.random() * 9,
            rise: 12 + Math.random() * 14,
            drift: depth > 100 ? 14 + Math.random() * 16 : 0,
            sway: Math.random() * Math.PI * 2,
            hue: Math.random() < 0.5 ? 275 : 195
          })
        }
      } else if (r < bubbleP + 0.52) {
        // 横档暗礁：从通道一侧伸出，逼你绕行
        var side = Math.random() < 0.5 ? 'l' : 'r'
        var reach = span * (0.32 + Math.random() * 0.3)
        var count = Math.max(2, Math.round(reach / 34))
        for (var i = 0; i < count; i++) {
          var rr = 16 + Math.random() * 18
          st.entities.push({
            type: 'rock',
            x: side === 'l' ? lane.min + i * (reach / count) : lane.max - i * (reach / count),
            worldY: worldY + Math.random() * 24,
            r: rr
          })
        }
      } else {
        var dir = Math.random() < 0.5 ? 1 : -1
        var y0 = worldY + Math.random() * 100
        for (var j = 0; j < 5; j++) {
          st.entities.push({
            type: 'fish',
            x: (dir === 1 ? -20 - j * 22 : st.w + 20 + j * 22),
            worldY: y0 + Math.sin(j * 1.3) * 14,
            r: 5,
            dir: dir,
            speed: 55 + Math.random() * 25,
            sway: j * 0.7
          })
        }
      }

      // 猎食者：120m 后不定期从下方逼近，追踪头灯
      if (depth > 120 && now >= st.nextHunterAt) {
        st.nextHunterAt = now + 12000 + Math.random() * 9000
        st.entities.push({
          type: 'hunter',
          x: lane.min + Math.random() * span,
          worldY: st.cameraY + st.h + 140,
          r: 20,
          vx: 0,
          climb: st.speed + 46 + Math.random() * 26,
          sway: Math.random() * Math.PI * 2
        })
      }
    }

    /* ---------- 更新 ---------- */
    function update (dt, now) {
      if (st.phase !== 'play') return

      st.speed = clamp(110 + st.depth * 0.55, 110, 430)
      st.cameraY += st.speed * dt
      st.depth = st.cameraY / PX_PER_M

      // 键盘控制
      var kb = 340 * dt
      if (st.keys.ArrowLeft || st.keys.a) st.diver.tx -= kb
      if (st.keys.ArrowRight || st.keys.d) st.diver.tx += kb
      if (st.keys.ArrowUp || st.keys.w) st.diver.ty -= kb
      if (st.keys.ArrowDown || st.keys.s) st.diver.ty += kb
      st.diver.tx = clamp(st.diver.tx, 24, st.w - 24)
      st.diver.ty = clamp(st.diver.ty, 60, st.h * 0.72)

      var ease = 1 - Math.pow(0.0018, dt)
      var dx = st.diver.tx - st.diver.x
      st.diver.x += dx * ease
      st.diver.y += (st.diver.ty - st.diver.y) * ease
      st.diver.tilt += (clamp(dx * 0.004, -0.5, 0.5) - st.diver.tilt) * Math.min(1, dt * 6)

      // 氧气：随深度加速消耗
      st.o2 -= (3.4 + st.depth * 0.012) * dt
      if (st.o2 <= 0) { st.o2 = 0; gameOver(); return }

      // 岩壁碰撞：擦到扣氧并被弹回通道内
      var diverGap = wallGap(st.cameraY + st.diver.y)
      if (diverGap) {
        var lo = diverGap.center - diverGap.half + st.diver.r
        var hi = diverGap.center + diverGap.half - st.diver.r
        if (st.diver.x < lo || st.diver.x > hi) {
          st.diver.x = clamp(st.diver.x, lo, hi)
          st.diver.tx = clamp(st.diver.tx, lo, hi)
          if (now > st.invulnUntil) {
            st.o2 -= 14
            st.invulnUntil = now + 750
            st.hitFlash = 0.7
            if (st.o2 <= 0) { st.o2 = 0; gameOver(); return }
          }
        }
      }

      // 尾迹气泡
      if (Math.random() < dt * 14) {
        st.trail.push({ x: st.diver.x - 14, worldY: st.cameraY + st.diver.y, r: 1.5 + Math.random() * 2.5, born: now })
        if (st.trail.length > 40) st.trail.shift()
      }

      spawn(now)

      var diverWorldY = st.cameraY + st.diver.y
      for (var i = st.entities.length - 1; i >= 0; i--) {
        var e = st.entities[i]
        if (e.type === 'bubble' || e.type === 'jelly') {
          e.worldY -= e.rise * dt
          e.x += Math.sin(now / 700 + e.sway) * 12 * dt
          // 深处的水母会缓缓朝潜水员漂移
          if (e.type === 'jelly' && e.drift) {
            e.x += clamp(st.diver.x - e.x, -1, 1) * e.drift * dt
          }
        } else if (e.type === 'fish') {
          e.x += e.dir * e.speed * dt
        } else if (e.type === 'hunter') {
          // 猎食者向上爬升并追踪头灯的横向位置
          e.worldY -= (e.climb - st.speed) * dt
          var chase = clamp(st.diver.x - e.x, -1, 1) * (58 + st.depth * 0.08)
          e.vx += (chase - e.vx) * Math.min(1, dt * 2.2)
          e.x += e.vx * dt + Math.sin(now / 460 + e.sway) * 16 * dt
        }

        var screenY = e.worldY - st.cameraY
        if (screenY < -140 || screenY > st.h + 260 || e.x < -160 || e.x > st.w + 160) {
          st.entities.splice(i, 1)
          continue
        }

        // 碰撞
        var ddx = e.x - st.diver.x
        var ddy = e.worldY - diverWorldY
        var dist2 = ddx * ddx + ddy * ddy
        var rr = (e.r + st.diver.r) * (e.r + st.diver.r)
        if (dist2 < rr) {
          if (e.type === 'bubble') {
            st.o2 = clamp(st.o2 + 13, 0, 100)
            st.entities.splice(i, 1)
          } else if (e.type === 'hunter' && now > st.invulnUntil) {
            st.o2 -= 34
            st.invulnUntil = now + 1200
            st.hitFlash = 1
            st.entities.splice(i, 1)
            if (st.o2 <= 0) { st.o2 = 0; gameOver(); return }
          } else if ((e.type === 'jelly' || e.type === 'rock') && now > st.invulnUntil) {
            st.o2 -= 24
            st.invulnUntil = now + 1100
            st.hitFlash = 1
            if (st.o2 <= 0) { st.o2 = 0; gameOver(); return }
          }
        }
      }

      if (st.hitFlash > 0) st.hitFlash = Math.max(0, st.hitFlash - dt * 2.2)
    }

    /* ---------- 绘制 ---------- */
    function lerpColor (a, b, t) {
      return [
        Math.round(a[0] + (b[0] - a[0]) * t),
        Math.round(a[1] + (b[1] - a[1]) * t),
        Math.round(a[2] + (b[2] - a[2]) * t)
      ]
    }

    function rgb (c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')' }

    function draw (now) {
      var ctx = refs.ctx
      ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0)

      var deepT = clamp(st.depth / 450, 0, 1)
      var top = lerpColor([23, 97, 143], [4, 12, 22], deepT)
      var bot = lerpColor([12, 60, 96], [2, 6, 12], deepT)
      var grad = ctx.createLinearGradient(0, 0, 0, st.h)
      grad.addColorStop(0, rgb(top))
      grad.addColorStop(1, rgb(bot))
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, st.w, st.h)

      // 浅水光柱
      if (deepT < 0.45) {
        ctx.save()
        ctx.globalAlpha = (0.45 - deepT) * 0.5
        for (var l = 0; l < 3; l++) {
          var lx = ((l * 0.37 + 0.15) * st.w + now / 90) % (st.w + 200) - 100
          var beam = ctx.createLinearGradient(lx, 0, lx - 80, st.h)
          beam.addColorStop(0, 'rgba(210,240,255,0.5)')
          beam.addColorStop(1, 'rgba(210,240,255,0)')
          ctx.fillStyle = beam
          ctx.beginPath()
          ctx.moveTo(lx - 25, -10)
          ctx.lineTo(lx + 25, -10)
          ctx.lineTo(lx - 55, st.h)
          ctx.lineTo(lx - 105, st.h)
          ctx.closePath()
          ctx.fill()
        }
        ctx.restore()
      }

      var darkness = clamp((st.depth - 70) / 280, 0, 0.93)
      var lightR = clamp(300 - st.depth * 0.35, 130, 300)

      // 海沟岩壁
      if (wallGap(st.cameraY + st.h)) {
        var rockCol = rgb(lerpColor([32, 52, 68], [10, 16, 24], deepT))
        var edgeCol = 'rgba(140, 190, 220, 0.16)'
        var rowStep = 26
        var left = []
        var right = []
        for (var sy = -rowStep; sy <= st.h + rowStep; sy += rowStep) {
          var g = wallGap(st.cameraY + sy)
          if (g) {
            left.push({ x: g.center - g.half, y: sy })
            right.push({ x: g.center + g.half, y: sy })
          } else {
            left.push({ x: -30, y: sy })
            right.push({ x: st.w + 30, y: sy })
          }
        }
        ctx.fillStyle = rockCol
        ctx.beginPath()
        ctx.moveTo(-40, -rowStep)
        left.forEach(function (pt) { ctx.lineTo(pt.x, pt.y) })
        ctx.lineTo(-40, st.h + rowStep)
        ctx.closePath()
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(st.w + 40, -rowStep)
        right.forEach(function (pt) { ctx.lineTo(pt.x, pt.y) })
        ctx.lineTo(st.w + 40, st.h + rowStep)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = edgeCol
        ctx.lineWidth = 2
        ctx.beginPath()
        left.forEach(function (pt, idx) { idx ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y) })
        ctx.stroke()
        ctx.beginPath()
        right.forEach(function (pt, idx) { idx ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y) })
        ctx.stroke()
      }

      // 尾迹
      ctx.fillStyle = 'rgba(220,240,255,0.35)'
      st.trail.forEach(function (b) {
        var sy = b.worldY - st.cameraY - (now - b.born) * 0.03
        if (sy < -10) return
        ctx.beginPath()
        ctx.arc(b.x, sy, b.r, 0, Math.PI * 2)
        ctx.fill()
      })

      // 实体
      st.entities.forEach(function (e) {
        var sy = e.worldY - st.cameraY
        if (sy < -60 || sy > st.h + 60) return

        if (e.type === 'bubble') {
          ctx.strokeStyle = 'rgba(200,235,255,0.85)'
          ctx.fillStyle = 'rgba(160,215,250,0.2)'
          ctx.lineWidth = 1.6
          ctx.beginPath()
          ctx.arc(e.x, sy, e.r, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
          ctx.beginPath()
          ctx.arc(e.x - e.r * 0.32, sy - e.r * 0.32, e.r * 0.24, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(255,255,255,0.75)'
          ctx.fill()
        } else if (e.type === 'jelly') {
          var pulse = 1 + Math.sin(now / 300 + e.sway) * 0.08
          var jr = e.r * pulse
          ctx.save()
          ctx.translate(e.x, sy)
          ctx.fillStyle = 'hsla(' + e.hue + ', 80%, 70%, 0.75)'
          ctx.beginPath()
          ctx.arc(0, 0, jr, Math.PI, 0)
          ctx.quadraticCurveTo(jr * 0.7, jr * 0.55, 0, jr * 0.45)
          ctx.quadraticCurveTo(-jr * 0.7, jr * 0.55, -jr, 0)
          ctx.fill()
          ctx.strokeStyle = 'hsla(' + e.hue + ', 85%, 78%, 0.55)'
          ctx.lineWidth = 1.4
          for (var t = -2; t <= 2; t++) {
            ctx.beginPath()
            ctx.moveTo(t * jr * 0.3, jr * 0.4)
            ctx.quadraticCurveTo(
              t * jr * 0.3 + Math.sin(now / 250 + t) * 5, jr * 1.1,
              t * jr * 0.24 + Math.sin(now / 250 + t + 1) * 7, jr * 1.7
            )
            ctx.stroke()
          }
          ctx.restore()
        } else if (e.type === 'rock') {
          ctx.fillStyle = rgb(lerpColor([40, 62, 80], [14, 22, 32], deepT))
          ctx.beginPath()
          ctx.moveTo(e.x - e.r, sy + e.r * 0.8)
          ctx.lineTo(e.x - e.r * 0.35, sy - e.r)
          ctx.lineTo(e.x + e.r * 0.45, sy - e.r * 0.5)
          ctx.lineTo(e.x + e.r, sy + e.r * 0.8)
          ctx.closePath()
          ctx.fill()
        } else if (e.type === 'fish') {
          ctx.save()
          ctx.translate(e.x, sy + Math.sin(now / 320 + e.sway) * 4)
          ctx.scale(e.dir, 1)
          ctx.fillStyle = 'rgba(180,215,235,0.55)'
          ctx.beginPath()
          ctx.ellipse(0, 0, 7, 3, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.beginPath()
          ctx.moveTo(-6, 0)
          ctx.lineTo(-11, -3.5)
          ctx.lineTo(-11, 3.5)
          ctx.closePath()
          ctx.fill()
          ctx.restore()
        } else if (e.type === 'hunter') {
          var hdir = e.vx >= 0 ? 1 : -1
          ctx.save()
          ctx.translate(e.x, sy)
          ctx.scale(hdir, 1)
          // 灯笼鱼身体
          ctx.fillStyle = 'rgba(20, 16, 30, 0.92)'
          ctx.beginPath()
          ctx.ellipse(0, 0, e.r, e.r * 0.62, 0, 0, Math.PI * 2)
          ctx.fill()
          // 尾鳍
          ctx.beginPath()
          ctx.moveTo(-e.r * 0.8, 0)
          ctx.lineTo(-e.r * 1.5, -e.r * 0.55)
          ctx.lineTo(-e.r * 1.5, e.r * 0.55)
          ctx.closePath()
          ctx.fill()
          // 血盆大口
          ctx.strokeStyle = 'rgba(240, 240, 255, 0.7)'
          ctx.lineWidth = 1.6
          ctx.beginPath()
          ctx.arc(e.r * 0.42, e.r * 0.1, e.r * 0.42, -0.5, 1.1)
          ctx.stroke()
          // 头顶小灯
          var lx = e.r * 0.55
          var ly = -e.r * 0.95
          ctx.strokeStyle = 'rgba(180, 220, 255, 0.5)'
          ctx.beginPath()
          ctx.moveTo(e.r * 0.2, -e.r * 0.5)
          ctx.quadraticCurveTo(e.r * 0.6, -e.r * 1.2, lx, ly)
          ctx.stroke()
          var lure = ctx.createRadialGradient(lx, ly, 0.5, lx, ly, 9)
          lure.addColorStop(0, 'rgba(190, 240, 255, 0.95)')
          lure.addColorStop(1, 'rgba(190, 240, 255, 0)')
          ctx.fillStyle = lure
          ctx.beginPath()
          ctx.arc(lx, ly, 9, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
      })

      // 潜水员
      var d = st.diver
      var blink = now < st.invulnUntil && Math.floor(now / 120) % 2 === 0
      if (!blink) {
        ctx.save()
        ctx.translate(d.x, d.y)
        ctx.rotate(d.tilt)

        // 头灯光锥（暗处才明显）
        if (darkness > 0.1) {
          var cone = ctx.createRadialGradient(10, 2, 4, 10, 2, 130)
          cone.addColorStop(0, 'rgba(255,244,200,' + (0.5 * darkness) + ')')
          cone.addColorStop(1, 'rgba(255,244,200,0)')
          ctx.fillStyle = cone
          ctx.beginPath()
          ctx.moveTo(8, 0)
          ctx.lineTo(135, 46)
          ctx.lineTo(135, -38)
          ctx.closePath()
          ctx.fill()
        }

        // 氧气瓶
        ctx.fillStyle = '#f2c94c'
        ctx.beginPath()
        ctx.ellipse(-6, -9, 10, 4.5, -0.25, 0, Math.PI * 2)
        ctx.fill()
        // 身体
        ctx.fillStyle = '#2d9cdb'
        ctx.beginPath()
        ctx.ellipse(0, 0, 15, 7.5, 0, 0, Math.PI * 2)
        ctx.fill()
        // 脚蹼
        ctx.fillStyle = '#1b6fa8'
        ctx.beginPath()
        ctx.moveTo(-13, 2)
        ctx.quadraticCurveTo(-26, 6 + Math.sin(now / 140) * 5, -22, 0)
        ctx.quadraticCurveTo(-26, -6 + Math.sin(now / 140) * 5, -13, -2)
        ctx.closePath()
        ctx.fill()
        // 头 + 面镜
        ctx.fillStyle = '#f2b9a1'
        ctx.beginPath()
        ctx.arc(13, -2, 6, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = 'rgba(180,235,255,0.95)'
        ctx.beginPath()
        ctx.arc(15, -2.5, 3.4, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      // 深海黑暗（头灯留一圈光）
      if (darkness > 0.02) {
        var dk = ctx.createRadialGradient(d.x, d.y, lightR * 0.36, d.x, d.y, lightR)
        dk.addColorStop(0, 'rgba(1,5,10,0)')
        dk.addColorStop(1, 'rgba(1,5,10,' + darkness + ')')
        ctx.fillStyle = dk
        ctx.fillRect(0, 0, st.w, st.h)

        // 发光生物穿透黑暗
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        st.entities.forEach(function (e) {
          var sy = e.worldY - st.cameraY
          if (sy < -60 || sy > st.h + 60) return
          if (e.type === 'jelly') {
            var g = ctx.createRadialGradient(e.x, sy, 1, e.x, sy, e.r * 2.6)
            g.addColorStop(0, 'hsla(' + e.hue + ', 90%, 70%, ' + (0.34 * darkness) + ')')
            g.addColorStop(1, 'hsla(' + e.hue + ', 90%, 70%, 0)')
            ctx.fillStyle = g
            ctx.fillRect(e.x - e.r * 3, sy - e.r * 3, e.r * 6, e.r * 6)
          } else if (e.type === 'bubble') {
            var gb = ctx.createRadialGradient(e.x, sy, 1, e.x, sy, e.r * 1.8)
            gb.addColorStop(0, 'rgba(160,220,255,' + (0.25 * darkness) + ')')
            gb.addColorStop(1, 'rgba(160,220,255,0)')
            ctx.fillStyle = gb
            ctx.fillRect(e.x - e.r * 2, sy - e.r * 2, e.r * 4, e.r * 4)
          } else if (e.type === 'hunter') {
            var hx = e.x + (e.vx >= 0 ? 1 : -1) * e.r * 0.55
            var hy = sy - e.r * 0.95
            var gh = ctx.createRadialGradient(hx, hy, 1, hx, hy, 34)
            gh.addColorStop(0, 'rgba(190,240,255,' + (0.5 * darkness) + ')')
            gh.addColorStop(1, 'rgba(190,240,255,0)')
            ctx.fillStyle = gh
            ctx.fillRect(hx - 36, hy - 36, 72, 72)
          }
        })
        ctx.restore()
      }

      // 受击红闪
      if (st.hitFlash > 0) {
        ctx.fillStyle = 'rgba(235,60,60,' + (st.hitFlash * 0.22) + ')'
        ctx.fillRect(0, 0, st.w, st.h)
      }

      // HUD
      var depthEl = hud.querySelector('#kg-depth')
      var bestEl = hud.querySelector('#kg-best')
      var o2El = hud.querySelector('#kg-o2')
      depthEl.textContent = '-' + Math.floor(st.depth) + 'm'
      bestEl.textContent = 'BEST -' + Math.max(getBest(), Math.floor(st.depth)) + 'm'
      o2El.style.width = st.o2 + '%'
      o2El.classList.toggle('kg-o2--low', st.o2 < 30)
    }

    function loop (now) {
      if (!refs) return
      var dt = st.lastT ? Math.min(0.05, (now - st.lastT) / 1000) : 0.016
      st.lastT = now
      update(dt, now)
      draw(now)
      refs.raf = requestAnimationFrame(loop)
    }
  }

  function stop () {
    if (!refs) return
    cancelAnimationFrame(refs.raf)
    refs.listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2]) })
    refs = null
  }

  window.KitchasGames.diver = { start: start, stop: stop }
})()
