$ErrorActionPreference = "Stop"

$fnmLine = "fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression"

Invoke-Expression $fnmLine
Write-Host "[ok] fnm enabled in this window" -ForegroundColor Green

if (-not (Test-Path -LiteralPath $PROFILE)) {
  $dir = Split-Path -Parent $PROFILE
  if ($dir -and -not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
  }
  New-Item -ItemType File -Path $PROFILE -Force | Out-Null
  Write-Host "[ok] created profile: $PROFILE" -ForegroundColor Yellow
}

$text = ""
if (Test-Path -LiteralPath $PROFILE) {
  $text = Get-Content -LiteralPath $PROFILE -Raw
}

if ($text -match "fnm env") {
  Write-Host "[skip] profile already has fnm" -ForegroundColor Yellow
}
else {
  Add-Content -LiteralPath $PROFILE -Value ""
  Add-Content -LiteralPath $PROFILE -Value "# fnm"
  Add-Content -LiteralPath $PROFILE -Value $fnmLine
  Write-Host "[ok] wrote fnm to profile: $PROFILE" -ForegroundColor Green
  Write-Host "Close PowerShell and open a new window." -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Next:"
Write-Host "  fnm install 22"
Write-Host "  fnm use 22"
Write-Host "  node -v"
