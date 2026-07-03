# Twikoo: Hugging Face -> Vercel migration helper
# Run from repo root:  .\scripts\twikoo-vercel-migrate.ps1

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path $PSScriptRoot -Parent
$ConfigPath = Join-Path $RepoRoot 'js\comments-config.js'

$Urls = @{
    MongoAtlas   = 'https://www.mongodb.com/cloud/atlas/register'
    TwikooDeploy = 'https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ftwikoojs%2Ftwikoo&project-name=twikoo&repository-name=twikoo&root-directory=src%2Fserver%2Fvercel&env=MONGODB_URI&envDescription=MongoDB%20connection%20string&envLink=https%3A%2F%2Ftwikoo.js.org%2Fmongodb-atlas.html'
    TwikooDocs   = 'https://twikoo.js.org/backend.html#vercel-%E9%83%A8%E7%BD%B2'
    QqMailSmtp   = 'https://mail.qq.com'
    ServerChan   = 'https://sct.ftqq.com/'
    HfAdmin      = 'https://kuohais-blog.hf.space'
}

function Show-Step([string]$Title, [string[]]$Lines) {
    Write-Host ''
    Write-Host "=== $Title ===" -ForegroundColor Cyan
    foreach ($line in $Lines) { Write-Host $line }
}

function Open-Url([string]$Url) {
    Start-Process $Url
}

Show-Step 'Twikoo Vercel migration' @(
    'Current envId: https://kuohais-blog.hf.space'
    'Target: Vercel + MongoDB Atlas (SMTP email supported)'
    ''
    'Tip: If HF already uses MongoDB Atlas, reuse the SAME MONGODB_URI on Vercel'
    '     to keep existing comments without export/import.'
)

$choice = Read-Host 'Open migration links in browser? [Y/n]'
if ($choice -notmatch '^[Nn]') {
    Open-Url $Urls.MongoAtlas
    Start-Sleep -Milliseconds 800
    Open-Url $Urls.TwikooDeploy
}

Show-Step 'Step 1 - MongoDB Atlas (skip if reusing HF database)' @(
    '1. Create free Shared cluster (M0, 512 MB)'
    '2. Database Access: add user with Atlas admin role; save password (no special chars)'
    '3. Network Access: allow 0.0.0.0/0'
    '4. Connect -> Drivers -> copy URI; replace <password> with your DB password'
)

Show-Step 'Step 2 - Deploy Twikoo on Vercel' @(
    '1. Log in to Vercel and deploy from the opened one-click link'
    '2. Settings -> Environment Variables -> MONGODB_URI = your connection string'
    '3. Settings -> Deployment Protection -> Vercel Authentication = Disabled'
    '4. Deployments -> ... -> Redeploy'
    '5. Visit the deployment URL; expect: Twikoo cloud function is running normally'
    '6. (Recommended) Domains -> add twikoo.kitchas.cn CNAME to cname.vercel-dns.com'
)

Show-Step 'Step 3 - Move data (only if using a NEW MongoDB)' @(
    '1. HF admin: export comments JSON'
    '2. Vercel admin: import comments JSON'
    'If reusing the same MONGODB_URI, skip this step.'
)

Show-Step 'Step 4 - Twikoo admin panel (gear icon on article page)' @(
    'SITE_NAME = 阔海生与海'
    'SITE_URL = https://kitchas.cn'
    'CORS_ALLOW_ORIGIN = https://kitchas.cn'
    'BLOGGER_EMAIL = 1344065382@qq.com'
    'REQUIRED_FIELDS = nick,mail'
    ''
    'SMTP (QQ mail):'
    '  SENDER_EMAIL / SMTP_USER = your QQ email'
    '  SMTP_SERVICE = QQ'
    '  SMTP_PASS = QQ mail authorization code (not QQ password)'
    '  SMTP_SECURE = true'
    ''
    'Optional: SC_SENDKEY for WeChat alerts via Server酱'
)

$newEnvId = Read-Host 'Enter new envId (e.g. https://twikoo.kitchas.cn or https://xxx.vercel.app)'
if ([string]::IsNullOrWhiteSpace($newEnvId)) {
    Write-Host 'No envId entered. Update js/comments-config.js manually when ready.' -ForegroundColor Yellow
    exit 0
}

$newEnvId = $newEnvId.Trim()
if ($newEnvId -notmatch '^https://') {
    $newEnvId = "https://$newEnvId"
}

$config = Get-Content $ConfigPath -Raw -Encoding UTF8
$updated = $config -replace "envId:\s*'[^']*'", "envId: '$newEnvId'"
if ($updated -eq $config) {
    throw "Could not update envId in $ConfigPath"
}

Set-Content -Path $ConfigPath -Value $updated -Encoding UTF8 -NoNewline
Write-Host ''
Write-Host "Updated $ConfigPath" -ForegroundColor Green
Write-Host "  envId: $newEnvId"
Write-Host ''
Write-Host 'Next: test comments on a post, then git commit and push when satisfied.'
