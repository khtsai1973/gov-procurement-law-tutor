$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host "找不到 npm。請先安裝 Node.js 22 並執行 fnm use 22" -ForegroundColor Red
  exit 1
}

Write-Host "=== corpus:refresh (MOJ download + ingest) ===" -ForegroundColor Cyan
npm run corpus:refresh
exit $LASTEXITCODE
