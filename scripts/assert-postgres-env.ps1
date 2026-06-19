function Read-EnvValue($name) {
  if (-not (Test-Path ".env")) { return $null }
  $line = Get-Content ".env" | Where-Object { $_ -match "^\s*$name\s*=" } | Select-Object -First 1
  if (-not $line) { return $null }
  return ($line -split "=", 2)[1].Trim().Trim('"').Trim("'")
}

function Show-PostgresUrlHelp {
  Write-Host ""
  Write-Host "Fix DATABASE_URL in .env (PostgreSQL only; SQLite file:./dev.db is no longer supported):" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "  Option A — Docker (local):" -ForegroundColor Cyan
  Write-Host "    docker compose up -d"
  Write-Host '    DATABASE_URL="postgresql://postgres:postgres@localhost:5432/gov_procurement"'
  Write-Host ""
  Write-Host "  Option B — Neon (cloud):" -ForegroundColor Cyan
  Write-Host "    Create a project at https://neon.tech and paste the connection string"
  Write-Host '    DATABASE_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"'
  Write-Host ""
  Write-Host "  Then: powershell -File .\init-db.ps1" -ForegroundColor Gray
  Write-Host "  See DEPLOY.md section 5 or run: powershell -File .\check-env.ps1" -ForegroundColor Gray
}

function Test-PostgresDatabaseUrl {
  param(
    [string]$DbUrl,
    [switch]$ExitOnFailure
  )

  if (-not $DbUrl) {
    Write-Host "[!!] DATABASE_URL is missing in .env" -ForegroundColor Red
    Write-Host "     Copy .env.example to .env and set a PostgreSQL URL." -ForegroundColor Yellow
    Show-PostgresUrlHelp
    if ($ExitOnFailure) { exit 1 }
    return $false
  }

  if ($DbUrl -match '^file:' -or $DbUrl -match 'sqlite') {
    Write-Host "[!!] DATABASE_URL is still SQLite ($($DbUrl.Substring(0, [Math]::Min(24, $DbUrl.Length)))...)" -ForegroundColor Red
    Write-Host "     This project uses PostgreSQL. Replace file:./dev.db with postgresql://..." -ForegroundColor Yellow
    Show-PostgresUrlHelp
    if ($ExitOnFailure) { exit 1 }
    return $false
  }

  if ($DbUrl -notmatch '^postgres(ql)?://') {
    Write-Host "[!!] DATABASE_URL must start with postgresql:// or postgres://" -ForegroundColor Red
    Write-Host "     Current value begins with: $($DbUrl.Substring(0, [Math]::Min(32, $DbUrl.Length)))..." -ForegroundColor Yellow
    Show-PostgresUrlHelp
    if ($ExitOnFailure) { exit 1 }
    return $false
  }

  return $true
}
