#!/usr/bin/env python3
"""Apply performance patches to all non-empty HTML pages."""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

REPLACEMENTS = [
    ('<link rel="preconnect" href="//busuanzi.ibruce.info"/>', ''),
    (
        '<link rel="preconnect" href="//cdn.jsdelivr.net"/>',
        '<link rel="dns-prefetch" href="//cdn.jsdelivr.net"/>',
    ),
    (
        '<link rel="stylesheet" href="/css/index.css">',
        '<link rel="preload" href="/css/index.css" as="style"><link rel="stylesheet" href="/css/index.css"><link rel="stylesheet" href="/css/perf.css">',
    ),
    (
        '<link rel="preload" href="/css/index.css" as="style"><link rel="stylesheet" href="/css/index.css">',
        '<link rel="preload" href="/css/index.css" as="style"><link rel="stylesheet" href="/css/index.css"><link rel="stylesheet" href="/css/perf.css">',
    ),
    (
        '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free/css/all.min.css" media="print" onload="this.media=\'all\'">',
        '',
    ),
    (
        "jQuery: 'https://cdn.jsdelivr.net/npm/jquery@latest/dist/jquery.min.js'",
        "jQuery: 'https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js'",
    ),
    (
        "js: 'https://cdn.jsdelivr.net/npm/@fancyapps/fancybox@latest/dist/jquery.fancybox.min.js'",
        "js: 'https://cdn.jsdelivr.net/npm/@fancyapps/fancybox@3.5.7/dist/jquery.fancybox.min.js'",
    ),
    (
        "css: 'https://cdn.jsdelivr.net/npm/@fancyapps/fancybox@latest/dist/jquery.fancybox.min.css'",
        "css: 'https://cdn.jsdelivr.net/npm/@fancyapps/fancybox@3.5.7/dist/jquery.fancybox.min.css'",
    ),
    ("url('/img/back.png')", "url('/img/back.jpg')"),
    (
        "background-image: url('https://i.loli.net/2020/05/19/aKOcLiyPl2JQdFD.png')",
        "background-image: url('/img/404.jpg')",
    ),
    (
        '<script defer src="/js/utils.js"></script><script defer src="/js/main.js"></script><script defer src="/js/tw_cn.js"></script><script defer src="/js/perf.js"></script>',
        '<script defer src="/js/utils.js"></script><script defer src="/js/main.js"></script><script defer src="/js/perf.js"></script>',
    ),
    (
        '<script src="/js/utils.js"></script><script src="/js/main.js"></script><script src="/js/tw_cn.js"></script>',
        '<script defer src="/js/utils.js"></script><script defer src="/js/main.js"></script><script defer src="/js/perf.js"></script>',
    ),
    (
        '<canvas class="fireworks" mobile="false"></canvas><script src="https://cdn.jsdelivr.net/npm/butterfly-extsrc@1/dist/fireworks.min.js"></script>',
        '<canvas class="fireworks" mobile="false"></canvas>',
    ),
    (
        '<script async data-pjax src="//busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js"></script>',
        '',
    ),
    (
        "getScript('https://cdn.jsdelivr.net/npm/typed.js/lib/typed.min.js').then(subtitleType)",
        "((window.requestIdleCallback||function(f){setTimeout(f,800)})(()=>getScript('https://cdn.jsdelivr.net/npm/typed.js@2.1.0/lib/typed.min.js').then(subtitleType)))",
    ),
    (
        "onerror=\"onerror=null;src='/img/friend_404.gif'\"",
        "onerror=\"onerror=null;this.src='/img/404.jpg'\"",
    ),
    (
        "onerror=\"this.onerror=null;this.src='/img/friend_404.gif'\"",
        "onerror=\"this.onerror=null;this.src='/img/404.jpg'\"",
    ),
]


def patch_file(path: Path) -> bool:
    text = path.read_text(encoding='utf-8')
    if not text.strip():
        return False
    original = text
    for old, new in REPLACEMENTS:
        text = text.replace(old, new)

    if path.name == '404.html':
        text = text.replace('<canvas class="fireworks" mobile="false"></canvas>', '')

    if path.name == 'index.html' and "url('/img/back.jpg')" in text:
        marker = '<link rel="preload" href="/css/index.css" as="style">'
        if marker in text and 'back.jpg' not in text.split('</head>')[0]:
            text = text.replace(
                marker,
                marker + '<link rel="preload" href="/img/back.jpg" as="image" fetchpriority="high">',
                1,
            )

    text = text.replace('<link rel="stylesheet" href="/css/perf.css"><link rel="stylesheet" href="/css/perf.css">', '<link rel="stylesheet" href="/css/perf.css">')
    if '/css/perf.css' not in text:
        text = text.replace(
            '<link rel="stylesheet" href="/css/index.css">',
            '<link rel="stylesheet" href="/css/index.css"><link rel="stylesheet" href="/css/perf.css">',
            1,
        )

    if text != original:
        path.write_text(text, encoding='utf-8')
        return True
    return False


def main() -> None:
    changed = []
    for html in ROOT.rglob('*.html'):
        if '.git' in html.parts or 'cdn-emoji' in html.parts:
            continue
        if patch_file(html):
            changed.append(html.relative_to(ROOT))
    print(f'Patched {len(changed)} file(s):')
    for item in changed:
        print(f'  - {item}')


if __name__ == '__main__':
    main()
