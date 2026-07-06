const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const momentsNav =
  '<div class="menus_item"><a class="site-page" href="/moments/"><i class="fa-fw fas fa-comment-dots"></i><span> 碎碎念</span></a></div>'
const navAnchor =
  'href="/timeline/"><i class="fa-fw fas fa-history"></i><span> 时间线</span></a></div>'
const navInsert = navAnchor + momentsNav

const templateSrc = path.join(root, 'about', 'index.html')
if (!fs.existsSync(templateSrc)) {
  console.error('Missing template:', templateSrc)
  process.exit(1)
}

let html = fs.readFileSync(templateSrc, 'utf8')

html = html.replace(
  '<title>关于海生 | 阔海生与海</title>',
  '<title>碎碎念 | 阔海生与海</title>'
)
html = html.replace(
  '<meta property="og:title" content="关于海生">',
  '<meta property="og:title" content="碎碎念">'
)
html = html.replace(
  'content="http://kuohais.github.io/about/"',
  'content="http://kuohais.github.io/moments/"'
)
html = html.replace(
  '<link rel="canonical" href="http://kuohais.github.io/about/">',
  '<link rel="canonical" href="http://kuohais.github.io/moments/">'
)

if (!html.includes('memos-feed.css')) {
  html = html.replace(
    '<link rel="stylesheet" href="/css/search.css">',
    '<link rel="stylesheet" href="/css/search.css"><link rel="stylesheet" href="/css/memos-feed.css">'
  )
}

html = html.replace(
  '<h1 id="site-title">关于海生</h1>',
  '<h1 id="site-title">碎碎念</h1>'
)

const momentsBody =
  '<h1 class="post-title">碎碎念</h1>' +
  '<div class="post-content">' +
  '<p class="memos-intro">日常短评与配图，同步自 Memos。手机打开 ' +
  '<a href="https://memos.kitchas.cn" target="_blank" rel="noopener">memos.kitchas.cn</a> 即可发文。</p>' +
  '<p id="memos-feed-status" class="memos-status">加载中…</p>' +
  '<div id="memos-feed" class="memos-feed"></div>' +
  '</div>'

html = html.replace(
  /<h1 class="post-title">关于海生<\/h1><div class="post-content">[\s\S]*?<\/div><\/div><\/div>/,
  momentsBody + '</div></div>'
)

if (!html.includes('href="/moments/"')) {
  html = html.split(navAnchor).join(navInsert)
}

const memosScripts =
  '<script defer src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>' +
  '<script defer src="/js/memos-config.js"></script>' +
  '<script defer src="/js/memos-feed.js"></script>'

if (!html.includes('memos-feed.js')) {
  html = html.replace(
    '<script defer src="/js/perf.js"></script>',
    '<script defer src="/js/perf.js"></script>' + memosScripts
  )
}

const momentsDir = path.join(root, 'moments')
fs.mkdirSync(momentsDir, { recursive: true })
const momentsFile = path.join(momentsDir, 'index.html')
fs.writeFileSync(momentsFile, html, 'utf8')
console.log('Created', momentsFile)

function patchNav (dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'cdn-emoji') continue
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      patchNav(full)
      continue
    }
    if (!ent.name.endsWith('.html')) continue

    let content = fs.readFileSync(full, 'utf8')
    if (content.includes('href="/moments/"') || !content.includes('href="/timeline/"')) {
      continue
    }

    const patched = content.split(navAnchor).join(navInsert)
    if (patched !== content) {
      fs.writeFileSync(full, patched, 'utf8')
      console.log('Nav patched', path.relative(root, full))
    }
  }
}

patchNav(root)

const sitemap = path.join(root, 'sitemap.xml')
if (fs.existsSync(sitemap)) {
  let map = fs.readFileSync(sitemap, 'utf8')
  if (!map.includes('/moments/')) {
    const entry = `
  <url>
    <loc>http://kuohais.github.io/moments/index.html</loc>
    <lastmod>2026-07-06</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
`
    map = map.replace('</urlset>', entry + '\n</urlset>')
    fs.writeFileSync(sitemap, map, 'utf8')
    console.log('Updated sitemap.xml')
  }
}

console.log('Moments feature applied.')
