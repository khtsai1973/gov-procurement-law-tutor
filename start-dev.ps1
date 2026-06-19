$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$nodeVer = (node -v) -replace "^v", ""
$major = [int]($nodeVer.Split(".")[0])
if ($major -ge 24) {
  Write-Host "目前 Node $(node -v)。若 prisma 失敗，請用 Node 22：fnm install 22 && fnm use 22" -ForegroundColor Yellow
  Write-Host "詳見 NODE22.md"
}

$nextPkg = Join-Path $PSScriptRoot "node_modules\next\package.json"
$prismaClient = Join-Path $PSScriptRoot "node_modules\.prisma\client\index.js"
. (Join-Path $PSScriptRoot "scripts\assert-postgres-env.ps1")
$dbUrl = Read-EnvValue "DATABASE_URL"

if (-not (Test-Path -LiteralPath $nextPkg)) {
  Write-Host "正在執行 npm install ..." -ForegroundColor Yellow
  npm install
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if (-not (Test-Path -LiteralPath $prismaClient)) {
  Write-Host "正在產生 Prisma Client ..." -ForegroundColor Yellow
  npm run db:generate
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Test-PostgresDatabaseUrl -DbUrl $dbUrl -ExitOnFailure | Out-Null

Write-Host "啟動開發伺服器: http://localhost:3000" -ForegroundColor Green
npm run dev
