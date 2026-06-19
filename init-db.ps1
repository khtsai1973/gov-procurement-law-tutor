$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$logFile = Join-Path $PSScriptRoot "init-db.log"
Remove-Item -Force $logFile -ErrorAction SilentlyContinue

function Run-Step($label, $command) {
  Write-Host ">> $label" -ForegroundColor Cyan
  # Prisma/npm often write info to stderr; with $ErrorActionPreference=Stop that aborts the script.
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    Invoke-Expression $command 2>&1 | Tee-Object -FilePath $logFile -Append
    $exit = if ($null -ne $LASTEXITCODE) { $LASTEXITCODE } else { 0 }
  } finally {
    $ErrorActionPreference = $prevEap
  }
  if ($exit -ne 0) {
    Write-Host "[failed] $label (exit $exit)" -ForegroundColor Red
    Write-Host "See log: $logFile" -ForegroundColor Yellow
    Get-Content $logFile -Tail 40
    exit $exit
  }
}

Write-Host "=== Initialize PostgreSQL (Prisma) ===" -ForegroundColor Cyan

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host "npm not found. Use Node 22 LTS (fnm use 22)." -ForegroundColor Red
  exit 1
}

Write-Host "node: $(node -v)" -ForegroundColor Gray

if (-not (Test-Path ".env")) {
  Write-Host "[!!] .env missing - copy from .env.example" -ForegroundColor Red
  exit 1
}

. (Join-Path $PSScriptRoot "scripts\assert-postgres-env.ps1")
$dbUrl = Read-EnvValue "DATABASE_URL"
if (Test-PostgresDatabaseUrl -DbUrl $dbUrl -ExitOnFailure) {
  $preview = $dbUrl.Substring(0, [Math]::Min(48, $dbUrl.Length))
  Write-Host "DATABASE_URL: ${preview}..." -ForegroundColor Gray
}

# Node runner avoids PowerShell treating Prisma stderr as fatal errors
Run-Step "db init (node)" "node scripts/run-db-init.mjs"

Write-Host "[ok] Schema pushed and seeded (see DATABASE_URL in .env)" -ForegroundColor Green
Write-Host "Optional: npm run corpus:rag-init" -ForegroundColor Gray
Write-Host "Done. Run: npm run dev" -ForegroundColor Green
