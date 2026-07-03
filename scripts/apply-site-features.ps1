$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Utf8 = New-Object System.Text.UTF8Encoding $false

$LocalSearchConfig = 'localSearch: {"path":"search.xml","languages":{"hits_empty":"找不到与「${query}」相关的文章","hits_stats":"共找到 ${hits} 条结果"}},'
$SearchButton = '<div id="search-button"><span class="site-page social-icon search"><i class="fas fa-search fa-fw"></i><span> 搜索</span></span></div>'
$SearchDialog = @'
<div id="local-search"><div class="search-dialog"><nav class="search-nav"><span class="search-dialog-title">搜索</span><button class="search-close-button" type="button" aria-label="关闭搜索"><i class="fas fa-times"></i></button></nav><div id="loading-database" class="text-center"><i class="fas fa-spinner fa-pulse"></i><span> 数据加载中...</span></div><div class="local-search-input" id="local-search-input"><input placeholder="输入关键词搜索本站文章..." type="search" autocomplete="off"></div><hr/><div id="local-search-results"></div></div><div id="search-mask"></div></div>
'@
$ReadProgress = '<div id="read-progress" aria-hidden="true"><div id="read-progress-bar"></div></div>'
$SearchCss = '<link rel="stylesheet" href="/css/search.css">'
$SearchScript = '<script defer src="/js/search/local-search.js"></script>'
$ReadProgressScript = '<script defer src="/js/read-progress.js"></script>'

function Patch-Html([string]$Html, [bool]$IsPost) {
    $Html = $Html -replace '<canvas class="fireworks" mobile="false"></canvas>', ''
    $Html = $Html -replace 'localSearch: undefined,', $LocalSearchConfig

    if ($Html -notmatch 'href="/css/search.css"') {
        $Html = $Html -replace '<link rel="stylesheet" href="/css/perf.css">', ('<link rel="stylesheet" href="/css/perf.css">' + $SearchCss)
    }

    if ($Html -match '<div id="menus"><div class="menus_items">' -and $Html -notmatch 'id="search-button"') {
        $Html = $Html -replace '<div id="menus"><div class="menus_items">', ('<div id="menus">' + $SearchButton + '<div class="menus_items">')
    }

    if ($Html -notmatch 'id="local-search"') {
        $Html = $Html -replace '<div id="web_bg"></div>', ('<div id="web_bg"></div>' + $SearchDialog)
    }

    if ($Html -notmatch 'local-search.js') {
        $Html = $Html -replace '<script defer src="/js/perf.js"></script>', ('<script defer src="/js/perf.js"></script>' + $SearchScript)
    }

    if ($IsPost) {
        if ($Html -notmatch 'id="read-progress"') {
            $Html = $Html -replace '<body>', ('<body>' + $ReadProgress)
        }
        if ($Html -notmatch 'read-progress.js') {
            $Html = $Html -replace '<script defer src="/js/twikoo.js"></script>', ('<script defer src="/js/twikoo.js"></script>' + $ReadProgressScript)
            if ($Html -notmatch 'read-progress.js') {
                $Html = $Html -replace '<script defer src="/js/perf.js"></script>', ('<script defer src="/js/perf.js"></script>' + $ReadProgressScript)
            }
        }
    }

    return $Html
}

Get-ChildItem -Path $Root -Filter '*.html' -Recurse | ForEach-Object {
    $rel = $_.FullName.Substring($Root.Length + 1)
    if ($rel -match '\\cdn-emoji\\') { return }
    $isPost = ($rel -match '^2021\\') -or ($rel -match 'isPost: true')
    $content = [System.IO.File]::ReadAllText($_.FullName, $Utf8)
    if (-not $isPost -and $content -match 'isPost: true') { $isPost = $true }
    $patched = Patch-Html $content $isPost
    if ($patched -ne $content) {
        [System.IO.File]::WriteAllText($_.FullName, $patched, $Utf8)
        Write-Host "Patched $rel"
    }
}

Write-Host 'Site features applied.'
