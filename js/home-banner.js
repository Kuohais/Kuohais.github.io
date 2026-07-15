(function () {
  'use strict'

  var OCEAN_PALETTES = [
    {
      sky: '#f4f8fb', skyDeep: '#e3eef7',
      waterTop: '#9fd4f2', waterMid: '#5bb8ea', waterDeep: '#49b1f5',
      foam: 'rgba(255, 255, 255, 0.7)',
      textDry: '#4c4948', textWet: '#ffffff'
    },
    {
      sky: '#f7f9fb', skyDeep: '#e8f2f8',
      waterTop: '#a8daf5', waterMid: '#62bceb', waterDeep: '#3aa3e0',
      foam: 'rgba(255, 255, 255, 0.68)',
      textDry: '#4c4948', textWet: '#ffffff'
    },
    {
      sky: '#f2f6f9', skyDeep: '#dde9f2',
      waterTop: '#96cfef', waterMid: '#55b2e6', waterDeep: '#389fd8',
      foam: 'rgba(255, 255, 255, 0.72)',
      textDry: '#4c4948', textWet: '#f5fbff'
    },
    {
      sky: '#eef5fa', skyDeep: '#d9e8f3',
      waterTop: '#8ec8eb', waterMid: '#4cade3', waterDeep: '#3498d4',
      foam: 'rgba(255, 255, 255, 0.65)',
      textDry: '#4c4948', textWet: '#ffffff'
    }
  ]

  var GAN_WUXING = {
    甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土',
    己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水'
  }

  var LINE_RATIO = 0.9
  var BOUNDS = {
    edgeMin: { min: 8, max: 28, ratio: 0.018 },
    lineGap: { min: 4, max: 36, preferRatio: 0.045 },
    fortuneGap: { min: 6, max: 40, preferRatio: 0.028 },
    fortuneSize: { min: 12, max: 42 },
    fontMin: 14,
    fontMinMicro: 11
  }

  var oceanState = null

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

  function luminance (hex) {
    var raw = hex.replace('#', '')
    var r = parseInt(raw.slice(0, 2), 16) / 255
    var g = parseInt(raw.slice(2, 4), 16) / 255
    var b = parseInt(raw.slice(4, 6), 16) / 255
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  function clamp (value, min, max) {
    return Math.min(max, Math.max(min, value))
  }

  function initLunarLocale () {
    if (typeof I18n !== 'undefined' && typeof I18n.setLanguage === 'function') {
      I18n.setLanguage('chs')
    }
  }

  function cleanLunarText (value) {
    var text = String(value == null ? '' : value).trim()
    if (!text || /^\{[^}]+\}$/.test(text)) return ''
    return text
  }

  function formatSolarMonth (date) {
    return (date.getMonth() + 1) + '月'
  }

  function formatSolarDay (date) {
    return date.getDate() + '日'
  }

  function fallbackFortune (date) {
    return '农历 ' + (date.getMonth() + 1) + '月' + date.getDate() + '日'
  }

  function formatFortuneLine (date, seed) {
    initLunarLocale()
    var lunarShort = '农历' + (date.getMonth() + 1) + '月' + date.getDate() + '日'

    try {
      if (typeof Solar === 'undefined') return lunarShort

      var solar = Solar.fromDate(date)
      var lunar = solar.getLunar()
      lunarShort = cleanLunarText(lunar.getMonthInChinese()) + '月' +
        cleanLunarText(lunar.getDayInChinese())
      var ganZhi = cleanLunarText(lunar.getDayInGanZhi())
      var naYin = cleanLunarText(lunar.getDayNaYin())
      var zhiXing = cleanLunarText(lunar.getZhiXing())
      var tianShen = cleanLunarText(lunar.getDayTianShen())
      var tianType = cleanLunarText(lunar.getDayTianShenType())
      var tianLuck = cleanLunarText(lunar.getDayTianShenLuck())
      var wuxing = GAN_WUXING[lunar.getDayGan()] || '—'

      var templates = [
        lunarShort + ' · ' + ganZhi + '日',
        '纳音 ' + naYin + ' · ' + zhiXing + '日',
        tianShen + '值日 · ' + tianType + (tianLuck ? ' · ' + tianLuck : ''),
        ganZhi + '日 · 五行' + wuxing,
        lunarShort + ' · ' + zhiXing + '日 · ' + tianType
      ].filter(function (item) {
        return item && item.indexOf('undefined') === -1 && item.indexOf('{') === -1
      })

      if (!templates.length) return lunarShort
      return templates[seed % templates.length]
    } catch (error) {
      console.warn('[home-banner] fortune', error)
      return lunarShort
    }
  }

  function applyOceanTheme (header, palette) {
    header.style.setProperty('--kitchas-banner-bg', palette.sky)
    header.style.setProperty('--kitchas-banner-sky-deep', palette.skyDeep)
    header.style.setProperty('--kitchas-banner-text', palette.textDry)
    header.style.setProperty('--kitchas-banner-text-wet', palette.textWet)
    header.classList.remove('kitchas-banner--light', 'kitchas-banner--dark')
    header.classList.add('kitchas-banner--light')
  }

  function measureTextWidth (text, fontWeight, fontSizePx) {
    var canvas = measureTextWidth._canvas || (measureTextWidth._canvas = document.createElement('canvas'))
    var ctx = canvas.getContext('2d')
    var family = window.getComputedStyle(document.body).fontFamily || 'sans-serif'
    ctx.font = fontWeight + ' ' + fontSizePx + 'px ' + family
    return ctx.measureText(text).width
  }

  function maxLineWidthAt (lines, fontWeight, fontSizePx, sizeScale) {
    var max = 0
    for (var i = 0; i < lines.length; i++) {
      var scale = sizeScale && sizeScale[i] ? sizeScale[i] : 1
      max = Math.max(max, measureTextWidth(lines[i], fontWeight, fontSizePx * scale))
    }
    return max
  }

  function layoutFlags (width, height) {
    // Only stack on truly narrow phones; keep side-by-side so date hugs the right
    var stacked = width < 420
    var tight = height < 520
    var micro = height < 400 || width < 340
    return { stacked: stacked, tight: tight, micro: micro }
  }

  function fontFloor (flags) {
    return flags.micro ? BOUNDS.fontMinMicro : BOUNDS.fontMin
  }

  function setModuleMetrics (moduleEl, fontSize, lineGap, fontMin) {
    var min = fontMin == null ? BOUNDS.fontMin : fontMin
    moduleEl.style.setProperty('--module-font-size', Math.max(min, fontSize) + 'px')
    moduleEl.style.setProperty('--module-line-gap', Math.max(0, lineGap) + 'px')
  }

  function applyModuleScale (moduleEl, scale, origin) {
    if (scale < 0.995) {
      moduleEl.style.transform = 'scale(' + scale.toFixed(4) + ')'
      moduleEl.style.transformOrigin = origin || 'left center'
    } else {
      moduleEl.style.transform = ''
      moduleEl.style.transformOrigin = ''
    }
  }

  function fitEqualHeightModule (moduleEl, config, bandHeight, flags) {
    var boxWidth = moduleEl.clientWidth
    var boxHeight = bandHeight || moduleEl.clientHeight
    if (!boxWidth || !boxHeight) return

    var lines = config.lines
    var n = config.lineCount
    var gaps = Math.max(0, n - 1)
    var gapMin = flags && flags.micro ? 2 : BOUNDS.lineGap.min
    var gapMax = BOUNDS.lineGap.max
    var minFont = fontFloor(flags || {})

    var probe = 100
    var natural = maxLineWidthAt(lines, config.fontWeight, probe, config.sizeScale)
    var maxByWidth = natural > 0 ? (boxWidth * probe) / natural : boxWidth
    var maxByHeight = (boxHeight - gaps * gapMin) / (n * LINE_RATIO)
    var high = Math.max(minFont, Math.min(maxByWidth, maxByHeight))
    var low = minFont
    var bestFont = low
    var bestGap = gapMin

    for (var i = 0; i < 18; i++) {
      var mid = (low + high) / 2
      var widthOk = maxLineWidthAt(lines, config.fontWeight, mid, config.sizeScale) <= boxWidth + 0.5
      var gapNeeded = gaps > 0 ? (boxHeight - n * mid * LINE_RATIO) / gaps : gapMin
      if (!widthOk || gapNeeded < gapMin) {
        high = mid
        continue
      }
      bestFont = mid
      bestGap = clamp(gapNeeded, gapMin, gapMax)
      low = mid
    }

    var gapAtBest = gaps > 0 ? (boxHeight - n * bestFont * LINE_RATIO) / gaps : gapMin
    bestGap = clamp(gapAtBest, gapMin, gapMax)
    setModuleMetrics(moduleEl, bestFont, bestGap, minFont)

    var usedWidth = maxLineWidthAt(lines, config.fontWeight, bestFont, config.sizeScale)
    var usedHeight = n * bestFont * LINE_RATIO + gaps * bestGap
    var scale = Math.min(
      1,
      usedWidth > 0 ? boxWidth / usedWidth : 1,
      usedHeight > 0 ? boxHeight / usedHeight : 1
    )
    applyModuleScale(moduleEl, scale, config.origin || 'left center')
  }

  function fitFortuneModule (fortuneEl, availableWidth, availableHeight, preferSize, flags) {
    var boxWidth = availableWidth || fortuneEl.clientWidth
    var boxHeight = availableHeight || fortuneEl.clientHeight
    if (!boxWidth) return
    if (!boxHeight || boxHeight < 20) boxHeight = flags && flags.micro ? 28 : 44

    var text = fortuneEl.textContent || ''
    var probe = 100
    var natural = measureTextWidth(text, '500', probe)
    var maxByWidth = natural > 0 ? (boxWidth * probe) / natural : preferSize
    var maxByHeight = boxHeight / 1.15
    var minSize = flags && flags.micro ? 11 : BOUNDS.fortuneSize.min
    var size = clamp(
      Math.min(preferSize || 24, maxByWidth, maxByHeight),
      minSize,
      BOUNDS.fortuneSize.max
    )
    fortuneEl.style.setProperty('--module-font-size', size + 'px')
  }

  function spacingForViewport (header) {
    var h = header.clientHeight || window.innerHeight || 800
    var w = header.clientWidth || window.innerWidth || 1200
    var flags = layoutFlags(w, h)

    header.classList.toggle('kitchas-banner--stacked', flags.stacked)
    header.classList.toggle('kitchas-banner--tight', flags.tight)
    header.classList.toggle('kitchas-banner--micro', flags.micro)

    // Horizontal inset for left content; right side stays tight to the page edge
    var edge = clamp(w * 0.016, BOUNDS.edgeMin.min, 20)
    if (flags.micro) edge = Math.min(edge, 10)
    var fortuneGap = clamp(
      h * (flags.micro ? 0.018 : flags.tight ? 0.024 : BOUNDS.fortuneGap.preferRatio),
      flags.micro ? 8 : 12,
      BOUNDS.fortuneGap.max
    )
    var fortuneRow = clamp(
      h * (flags.micro ? 0.05 : flags.tight ? 0.06 : 0.07),
      flags.micro ? 30 : flags.tight ? 38 : 48,
      flags.micro ? 48 : 80
    )
    var scrollZone = clamp(
      h * (flags.micro ? 0.05 : flags.tight ? 0.06 : 0.08),
      flags.micro ? 28 : 40,
      72
    )
    var navClear = clamp(
      h * (flags.micro ? 0.07 : 0.085),
      flags.micro ? 36 : 48,
      68
    )
    var lineGapPrefer = clamp(
      h * BOUNDS.lineGap.preferRatio,
      flags.micro ? 2 : BOUNDS.lineGap.min,
      BOUNDS.lineGap.max
    )

    header.style.setProperty('--edge-min', edge + 'px')
    header.style.setProperty('--fortune-gap', fortuneGap + 'px')
    header.style.setProperty('--fortune-row', fortuneRow + 'px')
    header.style.setProperty('--scroll-zone', scrollZone + 'px')
    header.style.setProperty('--nav-clear', navClear + 'px')
    header.style.setProperty('--line-gap', lineGapPrefer + 'px')

    return {
      fortuneGap: fortuneGap,
      fortuneRow: fortuneRow,
      flags: flags
    }
  }

  function fitBannerLayout (header) {
    var siteInfo = document.getElementById('site-info')
    var stack = header.querySelector('.kitchas-banner__stack')
    var main = header.querySelector('.kitchas-banner__main')
    var welcome = header.querySelector('.kitchas-banner__welcome')
    var date = header.querySelector('.kitchas-banner__date')
    var fortune = document.getElementById('kitchas-banner-fortune')
    if (!siteInfo || !stack || !main || !welcome || !date || !fortune) return

    var spacing = spacingForViewport(header)
    // Allow stacked/tight class changes to settle before measuring cells
    void header.offsetHeight

    if (!siteInfo.clientHeight || !siteInfo.clientWidth) return

    var monthText = (document.getElementById('kitchas-banner-month') || {}).textContent || '7月'
    var dayText = (document.getElementById('kitchas-banner-day') || {}).textContent || '10日'
    var welcomeH = welcome.clientHeight || siteInfo.clientHeight
    var dateH = date.clientHeight || siteInfo.clientHeight
    var flags = spacing.flags

    fitEqualHeightModule(welcome, {
      lines: ['Welcome', 'to', 'Kitchas.cn'],
      fontWeight: '700',
      lineCount: 3,
      sizeScale: [1, 1, 1.06],
      origin: 'left center'
    }, welcomeH, flags)

    fitEqualHeightModule(date, {
      lines: [monthText, dayText],
      fontWeight: '500',
      lineCount: 2,
      sizeScale: [1, 1],
      origin: 'right center'
    }, dateH, flags)

    var sidePad = Math.max(24, (parseFloat(getComputedStyle(header).getPropertyValue('--edge-min')) || 12) * 2)
    var fortunePrefer = clamp(spacing.fortuneRow / 1.2, BOUNDS.fortuneSize.min, BOUNDS.fortuneSize.max)
    fitFortuneModule(
      fortune,
      Math.max(80, header.clientWidth - sidePad),
      spacing.fortuneRow,
      fortunePrefer,
      flags
    )

    if (!String(fortune.textContent || '').trim()) {
      fortune.textContent = fallbackFortune(getBeijingDate())
    }

    if (oceanState && oceanState.clones) {
      syncWetClones(oceanState.clones)
    }
  }

  function buildWaveLayers (rng) {
    var layers = []
    var count = 3 + Math.floor(rng() * 2)
    for (var i = 0; i < count; i++) {
      layers.push({
        amp: 10 + rng() * 18,
        freq: 0.0035 + rng() * 0.006,
        speed: 0.45 + rng() * 0.85,
        phase: rng() * Math.PI * 2
      })
    }
    return layers
  }

  function waveY (layers, x, time, ampScale) {
    var y = 0
    for (var i = 0; i < layers.length; i++) {
      var layer = layers[i]
      y += layer.amp * ampScale * Math.sin(layer.freq * x + time * layer.speed + layer.phase)
    }
    return y
  }

  function ensureOceanCanvas (header) {
    var shapes = document.getElementById('kitchas-banner-shapes')
    if (!shapes) return null

    var ocean = document.getElementById('kitchas-banner-ocean')
    if (!ocean) {
      ocean = document.createElement('canvas')
      ocean.id = 'kitchas-banner-ocean'
      ocean.className = 'kitchas-banner__ocean'
      shapes.innerHTML = ''
      shapes.appendChild(ocean)
      shapes.setAttribute('aria-hidden', 'true')
    }

    // Remove old tint approach if still present
    var oldTint = document.getElementById('kitchas-banner-tint')
    if (oldTint) oldTint.remove()

    return ocean
  }

  function ensureStage (layer, id) {
    var stage = document.getElementById(id)
    if (!stage) {
      stage = document.createElement('div')
      stage.id = id
      stage.className = 'kitchas-banner__stage'
    }
    if (stage.parentElement !== layer) layer.appendChild(stage)
    return stage
  }

  function ensureTextLayers (header) {
    var dryInfo = document.getElementById('site-info')
    var dryFortune = document.getElementById('kitchas-banner-fortune')
    if (!dryInfo || !dryFortune) return null

    var dryLayer = document.getElementById('kitchas-banner-layer-dry')
    var wetLayer = document.getElementById('kitchas-banner-layer-wet')

    if (!dryLayer) {
      dryLayer = document.createElement('div')
      dryLayer.id = 'kitchas-banner-layer-dry'
      dryLayer.className = 'kitchas-banner__layer kitchas-banner__layer--dry'
      header.insertBefore(dryLayer, dryInfo)
    }

    if (!wetLayer) {
      wetLayer = document.createElement('div')
      wetLayer.id = 'kitchas-banner-layer-wet'
      wetLayer.className = 'kitchas-banner__layer kitchas-banner__layer--wet'
      wetLayer.setAttribute('aria-hidden', 'true')
      header.insertBefore(wetLayer, dryLayer.nextSibling)
    }

    var dryStage = ensureStage(dryLayer, 'kitchas-banner-stage-dry')
    if (dryInfo.parentElement !== dryStage) dryStage.appendChild(dryInfo)
    if (dryFortune.parentElement !== dryStage) dryStage.appendChild(dryFortune)

    var wetStage = ensureStage(wetLayer, 'kitchas-banner-stage-wet')

    var wetInfo = document.getElementById('site-info-wet')
    if (!wetInfo) {
      wetInfo = dryInfo.cloneNode(true)
      wetInfo.id = 'site-info-wet'
      wetInfo.classList.add('kitchas-banner__wet')
    }
    wetInfo.classList.add('kitchas-banner__wet')
    var nestedIds = wetInfo.querySelectorAll('[id]')
    for (var i = 0; i < nestedIds.length; i++) {
      if (nestedIds[i].id.slice(-4) !== '-wet') {
        nestedIds[i].id = nestedIds[i].id.replace(/-wet$/, '') + '-wet'
      }
    }
    if (wetInfo.parentElement !== wetStage) wetStage.appendChild(wetInfo)

    var wetFortune = document.getElementById('kitchas-banner-fortune-wet')
    if (!wetFortune) {
      wetFortune = dryFortune.cloneNode(true)
      wetFortune.id = 'kitchas-banner-fortune-wet'
    }
    wetFortune.classList.add('kitchas-banner__wet', 'kitchas-banner__fortune')
    if (wetFortune.parentElement !== wetStage) wetStage.appendChild(wetFortune)

    // Clear any old per-element clip-paths that caused misalignment
    ;[dryInfo, dryFortune, wetInfo, wetFortune].forEach(function (el) {
      el.style.clipPath = ''
      el.style.webkitClipPath = ''
    })

    return {
      dryLayer: dryLayer,
      wetLayer: wetLayer,
      dryStage: dryStage,
      wetStage: wetStage,
      dryInfo: dryInfo,
      wetInfo: wetInfo,
      dryFortune: dryFortune,
      wetFortune: wetFortune
    }
  }

  function syncWetClones (clones) {
    if (!clones) return

    clones.wetInfo.innerHTML = clones.dryInfo.innerHTML
    var nestedIds = clones.wetInfo.querySelectorAll('[id]')
    for (var i = 0; i < nestedIds.length; i++) {
      var id = nestedIds[i].id
      if (id.slice(-4) !== '-wet') nestedIds[i].id = id + '-wet'
    }

    clones.wetFortune.textContent = clones.dryFortune.textContent

    var dryWelcome = clones.dryInfo.querySelector('.kitchas-banner__welcome')
    var dryDate = clones.dryInfo.querySelector('.kitchas-banner__date')
    var wetWelcome = clones.wetInfo.querySelector('.kitchas-banner__welcome')
    var wetDate = clones.wetInfo.querySelector('.kitchas-banner__date')

    if (dryWelcome && wetWelcome) {
      wetWelcome.style.cssText = dryWelcome.style.cssText
      wetWelcome.style.setProperty('--module-font-size', dryWelcome.style.getPropertyValue('--module-font-size'))
      wetWelcome.style.setProperty('--module-line-gap', dryWelcome.style.getPropertyValue('--module-line-gap'))
    }
    if (dryDate && wetDate) {
      wetDate.style.cssText = dryDate.style.cssText
      wetDate.style.setProperty('--module-font-size', dryDate.style.getPropertyValue('--module-font-size'))
      wetDate.style.setProperty('--module-line-gap', dryDate.style.getPropertyValue('--module-line-gap'))
    }
    clones.wetFortune.style.setProperty(
      '--module-font-size',
      clones.dryFortune.style.getPropertyValue('--module-font-size') ||
        getComputedStyle(clones.dryFortune).getPropertyValue('--module-font-size')
    )
  }

  function polygonClip (points, mode, width, height) {
    var parts = []
    if (mode === 'air') {
      parts.push('0px 0px')
      parts.push(width + 'px 0px')
      for (var i = points.length - 1; i >= 0; i--) {
        parts.push(points[i].x.toFixed(1) + 'px ' + points[i].y.toFixed(1) + 'px')
      }
    } else {
      for (var j = 0; j < points.length; j++) {
        parts.push(points[j].x.toFixed(1) + 'px ' + points[j].y.toFixed(1) + 'px')
      }
      parts.push(width + 'px ' + height + 'px')
      parts.push('0px ' + height + 'px')
    }
    return 'polygon(' + parts.join(', ') + ')'
  }

  function applyWaveClips (state, points, width, height) {
    if (!state.clones || !state.clones.dryLayer || !state.clones.wetLayer) return
    var air = polygonClip(points, 'air', width, height)
    var water = polygonClip(points, 'water', width, height)

    state.clones.dryLayer.style.clipPath = air
    state.clones.dryLayer.style.webkitClipPath = air
    state.clones.wetLayer.style.clipPath = water
    state.clones.wetLayer.style.webkitClipPath = water
  }

  function resizeCanvas (canvas, width, height) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2)
    var nextW = Math.max(1, Math.floor(width * dpr))
    var nextH = Math.max(1, Math.floor(height * dpr))
    if (canvas.width !== nextW || canvas.height !== nextH) {
      canvas.width = nextW
      canvas.height = nextH
    }
    canvas.style.width = width + 'px'
    canvas.style.height = height + 'px'
    return dpr
  }

  function drawOceanFrame (state, now) {
    if (!state || !state.ocean) return

    var header = state.header
    var width = header.clientWidth
    var height = header.clientHeight
    if (!width || !height) return

    var scrollY = window.scrollY || document.documentElement.scrollTop || 0
    var velocity = Math.abs(scrollY - state.lastScrollY)
    state.lastScrollY = scrollY

    var pageFactor = clamp(scrollY / Math.max(height * 0.85, 1), 0, 1.6)
    var velocityFactor = clamp(velocity / 28, 0, 1.4)
    var targetBoost = 1 + pageFactor * 1.35 + velocityFactor * 1.1
    state.ampBoost += (targetBoost - state.ampBoost) * 0.08

    var time = (now - state.startTime) / 1000
    var waterline = height * state.waterlineRatio
    var ampScale = state.ampBoost

    var dpr = resizeCanvas(state.ocean, width, height)
    var octx = state.ocean.getContext('2d')
    octx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Sky
    var skyGrad = octx.createLinearGradient(0, 0, 0, waterline + 60)
    skyGrad.addColorStop(0, state.palette.sky)
    skyGrad.addColorStop(1, state.palette.skyDeep)
    octx.fillStyle = skyGrad
    octx.fillRect(0, 0, width, height)

    var step = Math.max(5, Math.floor(width / 160))
    var points = []
    for (var x = 0; x <= width + step; x += step) {
      points.push({
        x: x,
        y: waterline + waveY(state.layers, x, time, ampScale)
      })
    }

    // Water body — light theme blue, darker toward bottom
    octx.beginPath()
    octx.moveTo(points[0].x, points[0].y)
    for (var i = 1; i < points.length; i++) {
      octx.lineTo(points[i].x, points[i].y)
    }
    octx.lineTo(width + 2, height + 2)
    octx.lineTo(-2, height + 2)
    octx.closePath()

    var waterGrad = octx.createLinearGradient(0, waterline - 20, 0, height)
    waterGrad.addColorStop(0, state.palette.waterTop)
    waterGrad.addColorStop(0.42, state.palette.waterMid)
    waterGrad.addColorStop(1, state.palette.waterDeep)
    octx.fillStyle = waterGrad
    octx.fill()

    // Foam
    octx.beginPath()
    octx.moveTo(points[0].x, points[0].y)
    for (var j = 1; j < points.length; j++) {
      octx.lineTo(points[j].x, points[j].y)
    }
    octx.strokeStyle = state.palette.foam
    octx.lineWidth = 2 + Math.min(2.2, (ampScale - 1) * 1.4)
    octx.stroke()

    // Internal section traces
    octx.save()
    octx.beginPath()
    octx.moveTo(points[0].x, points[0].y)
    for (var k = 1; k < points.length; k++) octx.lineTo(points[k].x, points[k].y)
    octx.lineTo(width, height)
    octx.lineTo(0, height)
    octx.closePath()
    octx.clip()

    octx.globalAlpha = 0.14 + Math.min(0.1, (ampScale - 1) * 0.08)
    octx.strokeStyle = 'rgba(255, 255, 255, 0.65)'
    octx.lineWidth = 1
    for (var n = 1; n <= 3; n++) {
      var depth = waterline + n * (height - waterline) * 0.2
      octx.beginPath()
      for (var xx = 0; xx <= width; xx += step) {
        var yy = depth + waveY(state.layers, xx * 1.15 + n * 40, time * 0.75 + n, ampScale * 0.35)
        if (xx === 0) octx.moveTo(xx, yy)
        else octx.lineTo(xx, yy)
      }
      octx.stroke()
    }
    octx.restore()

    // Split dry/wet text colors by wave clip-paths
    applyWaveClips(state, points, width, height)
  }

  function applyInitialWaveClips (state) {
    if (!state || !state.header || !state.clones) return
    var width = state.header.clientWidth
    var height = state.header.clientHeight
    if (!width || !height) return

    var waterline = height * state.waterlineRatio
    var step = Math.max(5, Math.floor(width / 160))
    var points = []
    for (var x = 0; x <= width + step; x += step) {
      points.push({
        x: x,
        y: waterline + waveY(state.layers, x, 0, 1)
      })
    }
    applyWaveClips(state, points, width, height)
    if (state.clones.wetLayer) {
      state.clones.wetLayer.style.visibility = 'visible'
    }
  }

  function startOcean (header, seed, palette) {
    var ocean = ensureOceanCanvas(header)
    if (!ocean) return

    var clones = ensureTextLayers(header)
    syncWetClones(clones)

    // Hide wet clone until clip-path is ready — avoids stacked ghost text
    if (clones && clones.wetLayer) {
      clones.wetLayer.style.visibility = 'hidden'
    }

    var rng = createRng(seed + 41)
    if (oceanState && oceanState.raf) {
      window.cancelAnimationFrame(oceanState.raf)
    }

    oceanState = {
      header: header,
      ocean: ocean,
      clones: clones,
      palette: palette,
      layers: buildWaveLayers(rng),
      waterlineRatio: 0.48 + rng() * 0.06,
      ampBoost: 1,
      lastScrollY: window.scrollY || 0,
      startTime: performance.now(),
      raf: 0
    }

    applyInitialWaveClips(oceanState)

    function frame (now) {
      drawOceanFrame(oceanState, now)
      oceanState.raf = window.requestAnimationFrame(frame)
    }
    oceanState.raf = window.requestAnimationFrame(frame)
  }

  function renderBanner () {
    var header = document.getElementById('page-header')
    var monthEl = document.getElementById('kitchas-banner-month')
    var dayEl = document.getElementById('kitchas-banner-day')
    var fortuneEl = document.getElementById('kitchas-banner-fortune')
    if (!header || !header.classList.contains('kitchas-banner')) return false
    if (!monthEl || !dayEl || !fortuneEl) return false

    var date = getBeijingDate()
    var seed = hashSeed(dateKey(date))
    var palette = OCEAN_PALETTES[seed % OCEAN_PALETTES.length]

    header.classList.add('kitchas-banner--ocean')
    header.classList.remove('kitchas-banner--paper', 'kitchas-banner--coast')
    applyOceanTheme(header, palette)

    monthEl.textContent = formatSolarMonth(date)
    dayEl.textContent = formatSolarDay(date)
    fortuneEl.textContent = formatFortuneLine(date, seed) || fallbackFortune(date)

    // Remove leftover preview switch if present
    var oldSwitch = document.getElementById('kitchas-banner-style-switch')
    if (oldSwitch) oldSwitch.remove()

    startOcean(header, seed, palette)
    fitBannerLayout(header)
    return true
  }

  function bindResize (header) {
    var siteInfo = document.getElementById('site-info')
    if (!siteInfo) return

    var resizeTimer
    function scheduleFit () {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(function () {
        if (!header.classList.contains('kitchas-banner')) return
        fitBannerLayout(header)
      }, 32)
    }

    window.addEventListener('resize', scheduleFit)
    window.addEventListener('orientationchange', scheduleFit)

    if (typeof ResizeObserver !== 'undefined') {
      var observer = new ResizeObserver(scheduleFit)
      observer.observe(header)
      observer.observe(siteInfo)
    }
  }

  function boot (attempt) {
    var header = document.getElementById('page-header')
    if (renderBanner()) {
      bindResize(header)
      requestAnimationFrame(function () {
        fitBannerLayout(header)
        requestAnimationFrame(function () { fitBannerLayout(header) })
      })
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () {
          if (header && header.classList.contains('kitchas-banner')) fitBannerLayout(header)
        })
      }
      return
    }

    if ((attempt || 0) < 40) {
      setTimeout(function () { boot((attempt || 0) + 1) }, 50)
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { boot(0) })
  } else {
    boot(0)
  }
})()
