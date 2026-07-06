$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PyScript = Join-Path $ScriptDir 'apply-moments.py'

if (-not (Test-Path $PyScript)) {
    throw "Missing script: $PyScript"
}

$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    $python = Get-Command py -ErrorAction SilentlyContinue
    if ($python) {
        & py -3 $PyScript
    } else {
        throw 'Python is required to run apply-moments.py'
    }
} else {
    & python $PyScript
}

if ($LASTEXITCODE -ne 0) {
    throw "apply-moments.py failed with exit code $LASTEXITCODE"
}
