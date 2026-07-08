$root = Split-Path -Parent $PSScriptRoot
$port = if ($args[0]) { [int]$args[0] } else { 8080 }
$memosBase = 'https://memos.kitchas.cn'

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host "Blog server running at http://localhost:$port/"
Write-Host "Moments page: http://localhost:$port/moments/"
Write-Host "Memos API proxy: http://localhost:$port/memos-api/"
Write-Host "Press Ctrl+C to stop."

$mimes = @{
    '.html' = 'text/html; charset=utf-8'
    '.htm'  = 'text/html; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.xml'  = 'application/xml; charset=utf-8'
    '.svg'  = 'image/svg+xml'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.gif'  = 'image/gif'
    '.webp' = 'image/webp'
    '.ico'  = 'image/x-icon'
    '.woff' = 'font/woff'
    '.woff2'= 'font/woff2'
    '.ttf'  = 'font/ttf'
    '.txt'  = 'text/plain; charset=utf-8'
}

function Get-LocalPath([string]$urlPath) {
    $decoded = [System.Uri]::UnescapeDataString($urlPath.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($decoded)) { return Join-Path $root 'index.html' }
    $candidate = Join-Path $root $decoded
    if (Test-Path $candidate -PathType Container) {
        $index = Join-Path $candidate 'index.html'
        if (Test-Path $index) { return $index }
    }
    return $candidate
}

function Write-ResponseBytes([System.Net.HttpListenerResponse]$response, [byte[]]$bytes, [int]$statusCode, [string]$contentType) {
    $response.StatusCode = $statusCode
    $response.ContentType = $contentType
    $response.ContentLength64 = $bytes.Length
    $response.OutputStream.Write($bytes, 0, $bytes.Length)
}

function Invoke-MemosProxy([System.Net.HttpListenerRequest]$request, [System.Net.HttpListenerResponse]$response, [string]$prefix, [string]$targetBase) {
    $pathAndQuery = $request.Url.PathAndQuery
    if (-not $pathAndQuery.StartsWith($prefix)) {
        return $false
    }

    $suffix = $pathAndQuery.Substring($prefix.Length)
    if ([string]::IsNullOrWhiteSpace($suffix)) { $suffix = '/' }
    $targetUrl = ($targetBase.TrimEnd('/') + $suffix)

    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $client = New-Object System.Net.WebClient
        $client.Headers.Add('User-Agent', 'KuohaisBlogLocalProxy/1.0')
        $body = $client.DownloadData($targetUrl)
        $contentType = $client.ResponseHeaders['Content-Type']
        if ([string]::IsNullOrWhiteSpace($contentType)) {
            if ($targetUrl -match '\.(png|jpg|jpeg|gif|webp)(\?|$)') { $contentType = 'image/png' }
            elseif ($targetUrl -match '\.json(\?|$)') { $contentType = 'application/json; charset=utf-8' }
            else { $contentType = 'application/octet-stream' }
        }
        Write-ResponseBytes $response $body 200 $contentType
    } catch {
        $msg = [System.Text.Encoding]::UTF8.GetBytes('Memos proxy error: ' + $_.Exception.Message)
        Write-ResponseBytes $response $msg 502 'text/plain; charset=utf-8'
    }

    return $true
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        try {
            if (Invoke-MemosProxy $request $response '/memos-api' ($memosBase + '/api')) { continue }
            if (Invoke-MemosProxy $request $response '/memos-file' ($memosBase + '/file')) { continue }

            $localPath = Get-LocalPath $request.Url.LocalPath
            if (-not (Test-Path $localPath -PathType Leaf)) {
                $localPath = Join-Path $root '404.html'
                if (-not (Test-Path $localPath -PathType Leaf)) {
                    Write-ResponseBytes $response ([System.Text.Encoding]::UTF8.GetBytes('404 Not Found')) 404 'text/plain; charset=utf-8'
                    continue
                }
                $statusCode = 404
            } else {
                $statusCode = 200
            }

            $ext = [System.IO.Path]::GetExtension($localPath).ToLowerInvariant()
            $contentType = if ($mimes.ContainsKey($ext)) { $mimes[$ext] } else { 'application/octet-stream' }
            $bytes = [System.IO.File]::ReadAllBytes($localPath)
            Write-ResponseBytes $response $bytes $statusCode $contentType
        } catch {
            $msg = [System.Text.Encoding]::UTF8.GetBytes($_.Exception.Message)
            Write-ResponseBytes $response $msg 500 'text/plain; charset=utf-8'
        } finally {
            $response.Close()
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
