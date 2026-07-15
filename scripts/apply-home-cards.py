# -*- coding: utf-8 -*-
"""Transform homepage recent-post items into compact cover cards."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / 'index.html'
AUTHOR = '阔海生'


def clean_excerpt(raw: str) -> str:
    text = re.sub(r'<[^>]+>', '', raw)
    text = (
        text.replace('&nbsp;', ' ')
        .replace('&amp;', '&')
        .replace('&lt;', '<')
        .replace('&gt;', '>')
        .replace('&quot;', '"')
    )
    text = re.sub(r'^作者[：:]\s*[^\n|]*', '', text)
    text = text.replace('|', ' ')
    text = re.sub(r'\s+', ' ', text).strip()
    if len(text) > 96:
        return text[:96].rstrip() + '…'
    return text


def transform_item(item: str) -> str:
    title_m = re.search(
        r'<a class="article-title" href="([^"]+)"[^>]*(?:title="([^"]*)")?[^>]*>([^<]*)</a>',
        item,
    )
    cover_m = re.search(r'<div class="post_cover[\s\S]*?</div>', item)
    content_m = re.search(r'<div class="content">([\s\S]*?)</div>', item)
    if not title_m or not cover_m:
        return item.strip()

    href = title_m.group(1)
    title_attr = title_m.group(2) or title_m.group(3).strip()
    title = title_m.group(3).strip() or title_attr
    excerpt = clean_excerpt(content_m.group(1) if content_m else '')
    if not excerpt:
        excerpt = title

    cover = cover_m.group(0)
    cover = re.sub(r'\s(left_radius|right_radius)\b', '', cover)
    cover = cover.replace(
        'class="post_cover"',
        'class="post_cover home-latest-cover"',
        1,
    )

    return (
        '<div class="recent-post-item home-latest-card">'
        f'{cover}'
        '<div class="recent-post-info">'
        f'<a class="article-title" href="{href}" title="{title_attr}">{title}</a>'
        f'<div class="home-latest-card__author">{AUTHOR}</div>'
        f'<div class="content">{excerpt}</div>'
        '</div></div>'
    )


def main() -> None:
    html = INDEX.read_text(encoding='utf-8')
    start = html.find('id="recent-posts"')
    if start < 0:
        raise SystemExit('recent-posts not found')
    pag = html.find('<nav id="pagination">', start)
    if pag < 0:
        raise SystemExit('pagination not found')

    # section from id=... through content before pagination; include opening tag attrs
    open_end = html.find('>', start) + 1
    section_body = html[open_end:pag]

    header_m = re.search(
        r'<div class="home-latest__header">[\s\S]*?</div>',
        section_body,
    )
    header = header_m.group(0) if header_m else (
        '<div class="home-latest__header">'
        '<h2 class="home-latest__title">最新文章</h2>'
        '<a class="home-latest__more" href="/archives/">探索更多 '
        '<i class="fas fa-angle-right"></i></a></div>'
    )

    starts = [m.start() for m in re.finditer(r'<div class="recent-post-item\b', section_body)]
    items = []
    for i, s in enumerate(starts):
        e = starts[i + 1] if i + 1 < len(starts) else len(section_body)
        items.append(section_body[s:e])

    cards = [transform_item(item) for item in items[:5]]
    new_block = 'id="recent-posts" class="home-latest">' + header + ''.join(cards)
    INDEX.write_text(html[:start] + new_block + html[pag:], encoding='utf-8')
    print(f'updated {len(cards)} home cards')


if __name__ == '__main__':
    main()
