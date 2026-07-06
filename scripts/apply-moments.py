#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOMENTS_NAV = (
    '<div class="menus_item"><a class="site-page" href="/moments/">'
    '<i class="fa-fw fas fa-comment-dots"></i><span> 碎碎念</span></a></div>'
)
NAV_ANCHOR = (
    'href="/timeline/"><i class="fa-fw fas fa-history"></i><span> 时间线</span></a></div>'
)
NAV_INSERT = NAV_ANCHOR + MOMENTS_NAV

template_src = os.path.join(ROOT, 'about', 'index.html')
if not os.path.isfile(template_src):
    print('Missing template:', template_src, file=sys.stderr)
    sys.exit(1)

with open(template_src, encoding='utf-8') as f:
    html = f.read()

html = html.replace(
    '<title>关于海生 | 阔海生与海</title>',
    '<title>碎碎念 | 阔海生与海</title>',
)
html = html.replace(
    '<meta property="og:title" content="关于海生">',
    '<meta property="og:title" content="碎碎念">',
)
html = html.replace(
    'content="http://kuohais.github.io/about/"',
    'content="http://kuohais.github.io/moments/"',
)
html = html.replace(
    '<link rel="canonical" href="http://kuohais.github.io/about/">',
    '<link rel="canonical" href="http://kuohais.github.io/moments/">',
)

if 'memos-feed.css' not in html:
    html = html.replace(
        '<link rel="stylesheet" href="/css/search.css">',
        '<link rel="stylesheet" href="/css/search.css">'
        '<link rel="stylesheet" href="/css/memos-feed.css">',
    )

html = html.replace(
    '<h1 id="site-title">关于海生</h1>',
    '<h1 id="site-title">碎碎念</h1>',
)

moments_body = (
    '<h1 class="post-title">碎碎念</h1>'
    '<div class="post-content">'
    '<p class="memos-intro">日常短评与配图，同步自 Memos。手机打开 '
    '<a href="https://memos.kitchas.cn" target="_blank" rel="noopener">'
    'memos.kitchas.cn</a> 即可发文。</p>'
    '<p id="memos-feed-status" class="memos-status">加载中…</p>'
    '<div id="memos-feed" class="memos-feed"></div>'
    '</div>'
)

html = re.sub(
    r'<h1 class="post-title">关于海生</h1><div class="post-content">[\s\S]*?</div></div></div>',
    moments_body + '</div></div>',
    html,
    count=1,
)

if 'href="/moments/"' not in html:
    html = html.replace(NAV_ANCHOR, NAV_INSERT)

memos_scripts = (
    '<script defer src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>'
    '<script defer src="/js/memos-config.js"></script>'
    '<script defer src="/js/memos-feed.js"></script>'
)
if 'memos-feed.js' not in html:
    html = html.replace(
        '<script defer src="/js/perf.js"></script>',
        '<script defer src="/js/perf.js"></script>' + memos_scripts,
    )

moments_dir = os.path.join(ROOT, 'moments')
os.makedirs(moments_dir, exist_ok=True)
moments_file = os.path.join(moments_dir, 'index.html')
with open(moments_file, 'w', encoding='utf-8', newline='') as f:
    f.write(html)
print('Created', moments_file)


def patch_nav(directory):
    for name in os.listdir(directory):
        if name == 'cdn-emoji':
            continue
        full = os.path.join(directory, name)
        if os.path.isdir(full):
            patch_nav(full)
            continue
        if not name.endswith('.html'):
            continue
        with open(full, encoding='utf-8') as f:
            content = f.read()
        if 'href="/moments/"' in content or 'href="/timeline/"' not in content:
            continue
        patched = content.replace(NAV_ANCHOR, NAV_INSERT)
        if patched != content:
            with open(full, 'w', encoding='utf-8', newline='') as f:
                f.write(patched)
            print('Nav patched', os.path.relpath(full, ROOT))


patch_nav(ROOT)

sitemap = os.path.join(ROOT, 'sitemap.xml')
if os.path.isfile(sitemap):
    with open(sitemap, encoding='utf-8') as f:
        map_text = f.read()
    if '/moments/' not in map_text:
        entry = """
  <url>
    <loc>http://kuohais.github.io/moments/index.html</loc>
    <lastmod>2026-07-06</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
"""
        map_text = map_text.replace('</urlset>', entry + '\n</urlset>')
        with open(sitemap, 'w', encoding='utf-8', newline='') as f:
            f.write(map_text)
        print('Updated sitemap.xml')

print('Moments feature applied.')
