$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "Loading knowledge base..." -ForegroundColor Cyan
npm run corpus:ingest
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Done. Restart npm run dev if it is running." -ForegroundColor Green
