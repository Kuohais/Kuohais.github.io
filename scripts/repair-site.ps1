$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Utf8 = New-Object System.Text.UTF8Encoding $false

function Read-Utf8([string]$Path) {
    return [System.IO.File]::ReadAllText($Path, $Utf8)
}

function Write-Utf8([string]$Path, [string]$Content) {
    $dir = Split-Path $Path -Parent
    if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    [System.IO.File]::WriteAllText($Path, $Content, $Utf8)
}

function Remove-Playlist([string]$Html) {
    $Html = [regex]::Replace($Html, '<div class="menus_item"><a class="site-page" href="/playlist/">.*?</a></div>', '')
    return $Html
}

function Update-Announcement([string]$Html, [string]$Text) {
    return [regex]::Replace($Html, '(<div class="announcement_content">).*?(</div>)', "`${1}$Text`${2}")
}

function Add-CommentScripts([string]$Html, [string]$Scripts) {
    if ($Html -match 'comments-config\.js') { return $Html }
    return $Html -replace '<script defer src="/js/perf\.js"></script>', ('<script defer src="/js/perf.js"></script>' + $Scripts)
}

function Build-PageFromTemplate {
    param(
        [string]$Template,
        [string]$Title,
        [string]$Header,
        [string]$Canonical,
        [string]$MainHtml,
        [bool]$IsPost = $false,
        [string]$CommentScripts = ''
    )

    $html = $Template
    $siteName = 'Blog'
    if ($html -match '<title>[^|]+\|\s*([^<]+)</title>') { $siteName = $matches[1].Trim() }

    $html = [regex]::Replace($html, '<title>.*?</title>', "<title>$Title | $siteName</title>")
    $html = [regex]::Replace($html, '<meta property="og:title" content="[^"]*">', "<meta property=""og:title"" content=""$Title"">")
    $html = [regex]::Replace($html, '<meta property="og:url" content="http://kuohais\.github\.io[^"]*">', "<meta property=""og:url"" content=""http://kuohais.github.io$Canonical"">")
    $html = [regex]::Replace($html, '<link rel="canonical" href="http://kuohais\.github\.io[^"]*">', "<link rel=""canonical"" href=""http://kuohais.github.io$Canonical"">")
    $html = [regex]::Replace($html, '<h1 id="site-title">[^<]+</h1>', "<h1 id=""site-title"">$Header</h1>")
    $html = $html -replace 'isPost: false', ("isPost: " + ($(if ($IsPost) { 'true' } else { 'false' })))
    $html = [regex]::Replace($html, '<main class="layout" id="content-inner">.*?<div class="aside-content" id="aside-content">', "<main class=""layout"" id=""content-inner"">$MainHtml<div class=""aside-content"" id=""aside-content"">", 'Singleline')
    if ($IsPost) { $html = Add-CommentScripts $html $CommentScripts }
    return $html
}

$texts = Get-Content (Join-Path $PSScriptRoot 'page-texts.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$template = Read-Utf8 (Join-Path $Root 'archives\index.html')
$template = Remove-Playlist $template
$template = Update-Announcement $template $texts.announcement

# Patch all existing html files
Get-ChildItem -Path $Root -Filter '*.html' -Recurse | ForEach-Object {
    $content = Read-Utf8 $_.FullName
    $patched = Update-Announcement (Remove-Playlist $content) $texts.announcement
    if ($patched -ne $content) {
        Write-Utf8 $_.FullName $patched
        Write-Host "Patched $($_.FullName)"
    }
}

# Static pages
@(
    @{ key = 'about'; path = 'about\index.html' },
    @{ key = 'timeline'; path = 'timeline\index.html' },
    @{ key = 'categories'; path = 'categories\index.html' },
    @{ key = 'tags'; path = 'tags\index.html' }
) | ForEach-Object {
    $page = $texts.($_.key)
    $html = Build-PageFromTemplate -Template $template -Title $page.title -Header $page.header -Canonical $page.canonical -MainHtml $page.body
    Write-Utf8 (Join-Path $Root $_.path) $html
    Write-Host "Built $($_.path)"
}

# Posts from atom.xml
[xml]$atom = Read-Utf8 (Join-Path $Root 'atom.xml')
$ns = New-Object System.Xml.XmlNamespaceManager($atom.NameTable)
$ns.AddNamespace('atom', 'http://www.w3.org/2005/Atom')
$entries = $atom.SelectNodes('//atom:entry', $ns)

foreach ($entry in $entries) {
    $title = $entry.title
    $linkNode = $entry.SelectSingleNode('atom:link', $ns)
    $link = $linkNode.href
    $published = $entry.published
    $updated = $entry.updated
    $content = $entry.content.InnerText
    $content = $content -replace '\\assets\\', '/assets/'
    $categoryName = $entry.category.term
    $uri = [Uri]$link
    $path = $uri.AbsolutePath.TrimEnd('/')
    $canonical = "$path/"
    $localDir = [Uri]::UnescapeDataString($path.TrimStart('/'))
    $displayDate = ([DateTime]$published).ToString('yyyy-MM-dd')
    $displayDateFull = ([DateTime]$published).ToString('yyyy-MM-dd HH:mm:ss')

    $labels = $texts.postLabels
    $main = "<div id=""post""><article id=""article-container"" class=""post-content""><h1 class=""post-title"">$title</h1><div id=""post-meta""><span class=""post-meta-date""><i class=""far fa-calendar-alt""></i><span class=""article-meta-label"">$($labels.published)</span><time datetime=""$published"" title=""$($labels.published) $displayDateFull"">$displayDate</time></span><span class=""post-meta-categories""><span class=""article-meta__separator"">|</span><i class=""fas fa-inbox""></i><a class=""article-meta__categories"" href=""/categories/%E3%80%8A%E6%88%91%E7%9A%84%E5%BB%BA%E7%AB%99%E7%AC%94%E8%AE%B0%E3%80%8B/"">$categoryName</a></span></div><div class=""post-content"">$content</div><div id=""post-bottom""><div class=""post-copyright""><div class=""post-copyright__author""><span class=""post-copyright-meta""><i class=""fas fa-user-circle""></i>$($labels.author)</span><span class=""post-copyright-info""><a href=""https://github.com/Kuohais"">$($labels.authorName)</a></span></div><div class=""post-copyright__type""><span class=""post-copyright-meta""><i class=""fas fa-folder-open""></i>$($labels.category)</span><span class=""post-copyright-info""><a href=""/categories/%E3%80%8A%E6%88%91%E7%9A%84%E5%BB%BA%E7%AB%99%E7%AC%94%E8%AE%B0%E3%80%8B/"">$categoryName</a></span></div><div class=""post-copyright__updated""><span class=""post-copyright-meta""><i class=""fas fa-history""></i>$($labels.updated)</span><span class=""post-copyright-info""><time datetime=""$updated"">$displayDate</time></span></div></div></div></article>$($texts.commentBlock)</div>"

    $html = Build-PageFromTemplate -Template $template -Title $title -Header $title -Canonical $canonical -MainHtml $main -IsPost $true -CommentScripts $texts.commentScripts
    Write-Utf8 (Join-Path $Root (Join-Path $localDir 'index.html')) $html
    Write-Host "Built post $localDir"
}

Write-Host 'Repair complete.'
