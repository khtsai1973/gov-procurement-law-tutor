# Import full text: Government Procurement Act + Enforcement Rules
# Usage: powershell -ExecutionPolicy Bypass -File .\fetch-gpa-laws.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (Get-Command fnm -ErrorAction SilentlyContinue) {
  fnm use 22 | Out-Null
}

$cache = Join-Path $PSScriptRoot "data\moj-cache"
$agentTools = Join-Path $env:USERPROFILE ".cursor\projects\empty-window\agent-tools"
New-Item -ItemType Directory -Force -Path $cache | Out-Null

@(
  @{ src = "aea9b79d-7132-4db9-a3f8-6c7484b9b217.txt"; dst = "A0030057.json" },
  @{ src = "c07983de-cfc4-4410-9b76-09f3723db520.txt"; dst = "A0030058.json" }
) | ForEach-Object {
  $from = Join-Path $agentTools $_.src
  if (Test-Path $from) {
    Copy-Item $from (Join-Path $cache $_.dst) -Force
    Write-Host "[cache] $($_.dst)"
  }
}

Write-Host ">> Build Markdown from MOJ JSON ..."
node scripts\build-core-laws.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ">> Ingest corpus into database ..."
npm run corpus:ingest
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$actPath = Join-Path $PSScriptRoot "data\corpus\government-procurement-act.md"
$rulesPath = Join-Path $PSScriptRoot "data\corpus\gpa-enforcement-rules.md"

if (-not (Test-Path $actPath)) {
  Write-Error "Missing: $actPath"
}
if (-not (Test-Path $rulesPath)) {
  Write-Error "Missing: $rulesPath"
}

$act = Get-Item $actPath
$rules = Get-Item $rulesPath
$hasArticleHeadings = Select-String -Path $actPath -Pattern '^### ' -Quiet
$actBytes = $act.Length
$rulesBytes = $rules.Length

Write-Host ""
Write-Host "government-procurement-act.md : $actBytes bytes"
Write-Host "gpa-enforcement-rules.md      : $rulesBytes bytes"
Write-Host "Has article headings (###)    : $hasArticleHeadings"
if ($actBytes -lt 10000) {
  Write-Warning "Act file looks like a stub (< 10KB). Run: node scripts\build-core-laws.mjs"
}
if ($rulesBytes -lt 10000) {
  Write-Warning "Rules file looks like a stub (< 10KB). Run: node scripts\build-core-laws.mjs"
}
Write-Host ""
Write-Host "Done. Restart dev server if running: npm run dev"
