$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$outFile = Join-Path $root 'data/memos-feed.json'
$baseUrl = if ($env:MEMOS_BASE_URL) { $env:MEMOS_BASE_URL } else { 'https://memos.kitchas.cn' }
$filter = [uri]::EscapeDataString('visibility=="PUBLIC"')
$url = "$baseUrl/api/v1/memos?filter=$filter&pageSize=30&orderBy=create_time%20desc"

Write-Host "Fetching $url"

$data = Invoke-RestMethod -Uri $url -TimeoutSec 30
$dir = Split-Path -Parent $outFile
if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
}

$json = $data | ConvertTo-Json -Depth 20
[System.IO.File]::WriteAllText($outFile, $json, [System.Text.UTF8Encoding]::new($false))
Write-Host "Saved $($data.memos.Count) memos to $outFile"
