$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "=== Download laws from MOJ API ===" -ForegroundColor Cyan
npm run corpus:fetch-moj
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "=== Ingest into knowledge base ===" -ForegroundColor Cyan
npm run corpus:ingest
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Done. Restart npm run dev if needed." -ForegroundColor Green
