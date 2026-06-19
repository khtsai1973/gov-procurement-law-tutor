$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot

Write-Host "=== Auth / DB check ===" -ForegroundColor Cyan

. (Join-Path $PSScriptRoot "scripts\assert-postgres-env.ps1")

$secret = Read-EnvValue "AUTH_SECRET"
if (-not $secret) { $secret = Read-EnvValue "NEXTAUTH_SECRET" }
if ($secret) { Write-Host "[ok] AUTH_SECRET set" -ForegroundColor Green }
else { Write-Host "[!!] missing AUTH_SECRET" -ForegroundColor Red }

$gid = Read-EnvValue "GOOGLE_CLIENT_ID"
if (-not $gid) { $gid = Read-EnvValue "AUTH_GOOGLE_ID" }
if ($gid -and $gid -notmatch "replace-with" -and $gid -match "googleusercontent") {
  Write-Host "[ok] Google Client ID looks valid" -ForegroundColor Green
}
else {
  Write-Host "[!!] GOOGLE_CLIENT_ID missing or still placeholder" -ForegroundColor Red
  Write-Host "     See GOOGLE-OAUTH.md" -ForegroundColor Yellow
}

$dbUrl = Read-EnvValue "DATABASE_URL"
if (Test-PostgresDatabaseUrl -DbUrl $dbUrl) {
  Write-Host "[ok] DATABASE_URL is PostgreSQL ($($dbUrl.Substring(0, [Math]::Min(48, $dbUrl.Length)))...)" -ForegroundColor Green
}

Write-Host ""
Write-Host "node: $(node -v 2>$null)"
Write-Host "Done."
