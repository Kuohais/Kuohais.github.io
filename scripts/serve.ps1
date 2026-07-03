$root = Split-Path -Parent $PSScriptRoot
$port = if ($args[0]) { [int]$args[0] } else { 8080 }

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host "Blog server running at http://localhost:$port/"
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

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        try {
            $localPath = Get-LocalPath $request.Url.LocalPath
            if (-not (Test-Path $localPath -PathType Leaf)) {
                $localPath = Join-Path $root '404.html'
                if (-not (Test-Path $localPath -PathType Leaf)) {
                    $response.StatusCode = 404
                    $bytes = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
                    $response.ContentType = 'text/plain; charset=utf-8'
                    $response.OutputStream.Write($bytes, 0, $bytes.Length)
                    $response.Close()
                    continue
                }
                $response.StatusCode = 404
            } else {
                $response.StatusCode = 200
            }

            $ext = [System.IO.Path]::GetExtension($localPath).ToLowerInvariant()
            $response.ContentType = if ($mimes.ContainsKey($ext)) { $mimes[$ext] } else { 'application/octet-stream' }
            $bytes = [System.IO.File]::ReadAllBytes($localPath)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } catch {
            $response.StatusCode = 500
            $msg = [System.Text.Encoding]::UTF8.GetBytes($_.Exception.Message)
            $response.OutputStream.Write($msg, 0, $msg.Length)
        } finally {
            $response.Close()
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
