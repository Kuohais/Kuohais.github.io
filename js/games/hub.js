/* 游戏中心：负责全屏容器与游戏脚本的按需加载 */
(function () {
  'use strict'

  window.KitchasGames = window.KitchasGames || {}

  var TITLES = { diver: '深潜者 · Deep Diver', sonar: '深海回声 · Echo Hunt' }
  var overlay = null
  var stage = null
  var current = null

  function ensureOverlay () {
    if (overlay) return overlay
    overlay = document.createElement('div')
    overlay.id = 'kitchas-game-overlay'
    overlay.innerHTML =
      '<div class="kg-topbar">' +
      '<span class="kg-topbar__title" id="kg-title"></span>' +
      '<button class="kg-topbar__close" type="button" id="kg-close">退出 Esc</button>' +
      '</div>' +
      '<div class="kg-stage" id="kg-stage"></div>'
    document.body.appendChild(overlay)
    stage = overlay.querySelector('#kg-stage')

    overlay.querySelector('#kg-close').addEventListener('click', closeGame)
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('kg-open')) closeGame()
    })
    return overlay
  }

  function loadGameScript (name) {
    return new Promise(function (resolve, reject) {
      if (window.KitchasGames[name]) { resolve(); return }
      var s = document.createElement('script')
      s.src = '/js/games/' + name + '.js'
      s.async = true
      s.onload = resolve
      s.onerror = reject
      document.body.appendChild(s)
    })
  }

  function openGame (name) {
    ensureOverlay()
    overlay.querySelector('#kg-title').textContent = TITLES[name] || name
    overlay.classList.add('kg-open')
    document.body.style.overflow = 'hidden'
    stage.innerHTML = '<div class="kg-loading">正在下潜…</div>'

    loadGameScript(name).then(function () {
      var game = window.KitchasGames[name]
      if (!game) return
      stage.innerHTML = ''
      current = game
      game.start(stage)
    }).catch(function () {
      stage.innerHTML = '<div class="kg-loading">加载失败，请刷新重试</div>'
    })
  }

  function closeGame () {
    if (current && current.stop) current.stop()
    current = null
    overlay.classList.remove('kg-open')
    document.body.style.overflow = ''
    stage.innerHTML = ''
  }

  window.KitchasGames.open = openGame
  window.KitchasGames.close = closeGame

  function bind () {
    document.querySelectorAll('[data-kg-game]').forEach(function (el) {
      el.addEventListener('click', function () {
        openGame(el.getAttribute('data-kg-game'))
      })
    })
    // 支持 /game/#diver 或 /game/#sonar 直达
    var hash = (location.hash || '').replace('#', '')
    if (hash === 'diver' || hash === 'sonar') openGame(hash)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind)
  } else {
    bind()
  }
})()
