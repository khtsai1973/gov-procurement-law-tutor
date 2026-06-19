$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$nodeVer = (node -v) -replace "^v", ""
$major = [int]($nodeVer.Split(".")[0])
if ($major -ge 24) {
  Write-Host ""
  Write-Host "目前 Node.js 為 v$nodeVer（LTS 可能已是 v24）。" -ForegroundColor Yellow
  Write-Host "若 prisma generate 失敗，請改用 Node 22 執行本腳本（見專案內 NODE22.md）。" -ForegroundColor Yellow
  Write-Host ""
}

Write-Host "移除 node_modules 與 package-lock.json ..." -ForegroundColor Yellow
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue

Write-Host "npm install ..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "prisma generate ..." -ForegroundColor Yellow
npm run db:generate
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "prisma db push ..." -ForegroundColor Yellow
npm run db:push
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "db seed ..." -ForegroundColor Yellow
npm run db:seed
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "完成。可執行: npm run dev" -ForegroundColor Green
