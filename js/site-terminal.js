/* 站点伪终端彩蛋：按 ` 呼出（由 perf.js 按需加载） */
(function () {
  'use strict'

  if (window.KitchasTerminal) return

  var PAGES = [
    { path: '/', name: 'index/', desc: '主页' },
    { path: '/archives/', name: 'archives/', desc: '文章总览' },
    { path: '/moments/', name: 'moments/', desc: '碎碎念' },
    { path: '/timeline/', name: 'timeline/', desc: '时间线' },
    { path: '/game/', name: 'game/', desc: '海边游戏厅' },
    { path: '/about/', name: 'about/', desc: '关于海生' }
  ]

  var POSTS = [
    { path: '/2021/04/27/%E3%80%8A%E6%88%91%E7%9A%84%E5%BB%BA%E7%AB%99%E7%AC%94%E8%AE%B0%E3%80%8B%E4%B8%89/', name: '《我的建站笔记》三' },
    { path: '/2021/04/12/%E3%80%8A%E6%88%91%E7%9A%84%E5%BB%BA%E7%AB%99%E7%AC%94%E8%AE%B0%E3%80%8B%E4%BA%8C/', name: '《我的建站笔记》二' },
    { path: '/2021/04/12/%E3%80%8A%E6%88%91%E7%9A%84%E5%BB%BA%E7%AB%99%E7%AC%94%E8%AE%B0%E3%80%8B%E4%B8%80/', name: '《我的建站笔记》一' }
  ]

  var NEOFETCH = [
    '      ~~  ~~~  ~~        kuohais@kitchas.cn',
    '   ~~~~~~~~~~~~~~~~      -------------------',
    '  ~ 阔海生与海 ~ 🌊      站名: 阔海生与海',
    '   ~~~~~~~~~~~~~~~~      框架: Hexo 5.4.1',
    '      ~~~  ~~  ~~        主题: Butterfly',
    '        ><(((º>          文章: 3 篇',
    '                         启航: 2021-03-31',
    '     ` 键开关此终端      口号: May the force be with you.'
  ]

  var CSS = [
    '#kitchas-term{position:fixed;left:0;right:0;top:0;z-index:9999;max-height:46vh;display:flex;flex-direction:column;',
    'background:rgba(13,27,38,0.94);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);',
    'border-bottom:2px solid rgba(73,177,245,0.55);box-shadow:0 12px 40px rgba(0,20,40,0.5);',
    'font-family:ui-monospace,"Cascadia Code","JetBrains Mono",Consolas,monospace;font-size:13px;color:#cfe6f5;',
    'transform:translateY(-100%);transition:transform 0.28s cubic-bezier(0.3,0.9,0.4,1);}',
    '#kitchas-term.kitchas-term--open{transform:translateY(0);}',
    '#kitchas-term-out{flex:1 1 auto;overflow-y:auto;padding:0.9rem 1.1rem 0.4rem;line-height:1.65;white-space:pre-wrap;word-break:break-all;}',
    '#kitchas-term-out a{color:#49b1f5;text-decoration:none;}',
    '#kitchas-term-out a:hover{text-decoration:underline;}',
    '#kitchas-term-out .t-dim{color:#7d95a8;}',
    '#kitchas-term-out .t-ok{color:#7ee787;}',
    '#kitchas-term-out .t-warn{color:#e6a23c;}',
    '#kitchas-term-form{display:flex;align-items:center;gap:0.5rem;padding:0.45rem 1.1rem 0.75rem;}',
    '#kitchas-term-form .t-prompt{color:#7ee787;flex-shrink:0;}',
    '#kitchas-term-in{flex:1 1 auto;background:none;border:0;outline:none;color:#e8f4fd;',
    'font:inherit;caret-color:#49b1f5;}',
    '@media (max-width:600px){#kitchas-term{max-height:60vh;font-size:12px;}}'
  ].join('')

  var style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)

  var root = document.createElement('div')
  root.id = 'kitchas-term'
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-label', '站点终端')
  root.innerHTML =
    '<div id="kitchas-term-out"></div>' +
    '<form id="kitchas-term-form"><span class="t-prompt">visitor@kitchas:~$</span>' +
    '<input id="kitchas-term-in" type="text" autocomplete="off" spellcheck="false" aria-label="终端输入"></form>'
  document.body.appendChild(root)

  var out = root.querySelector('#kitchas-term-out')
  var input = root.querySelector('#kitchas-term-in')
  var history = []
  var histIdx = -1
  var open = false

  function print (html, cls) {
    var line = document.createElement('div')
    if (cls) line.className = cls
    line.innerHTML = html
    out.appendChild(line)
    out.scrollTop = out.scrollHeight
  }

  function esc (s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  var COMMANDS = {
    help: function () {
      print(
        '可用命令：\n' +
        '  <span class="t-ok">ls</span>        列出页面与文章\n' +
        '  <span class="t-ok">cd</span> &lt;n&gt;    前往第 n 项（或路径），如 cd 2\n' +
        '  <span class="t-ok">play</span>      去海边游戏厅（play diver / play sonar 直达）\n' +
        '  <span class="t-ok">fortune</span>   查看今日签（每日一抽）\n' +
        '  <span class="t-ok">neofetch</span>  站点信息\n' +
        '  <span class="t-ok">theme</span>     切换明暗主题\n' +
        '  <span class="t-ok">about</span> / <span class="t-ok">date</span> / <span class="t-ok">echo</span> / <span class="t-ok">clear</span> / <span class="t-ok">exit</span>'
      )
    },
    about: function () {
      print('阔海生与海 —— 唯有时驻足敛羽，方可远行。\n一个用 Hexo + Butterfly 搭建的技术小站，2021 年启航。')
    },
    ls: function () {
      var lines = ['<span class="t-dim"># 页面</span>']
      var idx = 1
      PAGES.forEach(function (p) {
        lines.push('  [' + idx + '] <a href="' + p.path + '">' + p.name + '</a>  <span class="t-dim">' + p.desc + '</span>')
        idx++
      })
      lines.push('<span class="t-dim"># 文章</span>')
      POSTS.forEach(function (p) {
        lines.push('  [' + idx + '] <a href="' + p.path + '">' + esc(p.name) + '</a>')
        idx++
      })
      print(lines.join('\n'))
    },
    cd: function (args) {
      var all = PAGES.concat(POSTS)
      var arg = (args[0] || '').trim()
      if (!arg) { print('用法：cd &lt;编号|路径&gt;，先用 ls 查看编号', 't-warn'); return }
      var n = parseInt(arg, 10)
      var target = null
      if (!isNaN(n) && n >= 1 && n <= all.length) target = all[n - 1].path
      else if (arg.charAt(0) === '/') target = arg
      if (!target) { print('找不到目标：' + esc(arg), 't-warn'); return }
      print('正在前往 ' + target + ' ...', 't-dim')
      setTimeout(function () { window.location.href = target }, 350)
    },
    play: function (args) {
      var which = (args[0] || '').toLowerCase()
      var target = '/game/'
      if (which === 'diver' || which === 'sonar') target += '#' + which
      print('正在打开海边游戏厅 🕹️ ...', 't-dim')
      setTimeout(function () { window.location.href = target }, 350)
    },
    fortune: function () {
      var saved = null
      try { saved = JSON.parse(localStorage.getItem('kitchas-draw-last') || 'null') } catch (e) {}
      var now = new Date()
      var bj = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 8 * 3600000)
      var key = bj.getFullYear() + '-' +
        String(bj.getMonth() + 1).padStart(2, '0') + '-' +
        String(bj.getDate()).padStart(2, '0')
      if (saved && saved.date === key) {
        print(
          '今日 <span class="t-warn">' + esc(saved.level) + '</span> — ' + esc(saved.poem) + '\n' +
          '宜：' + esc(saved.yi.join('、')) + '  忌：' + esc(saved.ji.join('、'))
        )
      } else {
        print('今天还没抽签。去<a href="/">主页</a>捞一只漂流瓶吧 🍾', 't-dim')
      }
    },
    neofetch: function () {
      print('<span style="color:#49b1f5">' + esc(NEOFETCH.join('\n')) + '</span>')
    },
    theme: function () {
      var btn = document.getElementById('darkmode')
      if (btn) { btn.click(); print('主题已切换', 't-ok') } else {
        print('当前页面不支持切换', 't-warn')
      }
    },
    date: function () {
      print(new Date().toLocaleString('zh-CN'))
    },
    echo: function (args) {
      print(esc(args.join(' ')))
    },
    clear: function () {
      out.innerHTML = ''
    },
    exit: function () {
      api.close()
    }
  }

  function run (raw) {
    var text = raw.trim()
    print('<span class="t-ok">visitor@kitchas:~$</span> ' + esc(text))
    if (!text) return
    history.push(text)
    histIdx = history.length
    var parts = text.split(/\s+/)
    var cmd = parts[0].toLowerCase()
    var fn = COMMANDS[cmd] || (cmd === 'goto' || cmd === 'open' ? COMMANDS.cd : null)
    if (fn) fn(parts.slice(1))
    else print('命令不存在：' + esc(cmd) + '（输入 help 查看可用命令）', 't-warn')
  }

  root.querySelector('#kitchas-term-form').addEventListener('submit', function (e) {
    e.preventDefault()
    run(input.value)
    input.value = ''
  })

  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (histIdx > 0) { histIdx--; input.value = history[histIdx] || '' }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (histIdx < history.length) { histIdx++; input.value = history[histIdx] || '' }
    } else if (e.key === 'Escape' || (e.key === '`' && !input.value)) {
      e.preventDefault()
      api.close()
    }
  })

  var api = {
    open: function () {
      open = true
      root.classList.add('kitchas-term--open')
      setTimeout(function () { input.focus() }, 120)
    },
    close: function () {
      open = false
      root.classList.remove('kitchas-term--open')
      input.blur()
    },
    toggle: function () {
      if (open) api.close()
      else api.open()
    }
  }

  window.KitchasTerminal = api

  print('<span class="t-dim">阔海生与海 · 站点终端 —— 输入 <span class="t-ok">help</span> 查看命令，` 或 Esc 关闭</span>')
})()
