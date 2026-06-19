$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Log($msg) {
  Write-Host $msg
  Add-Content -Path .cursor-setup.log -Value $msg
}

function Require-Command($name) {
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if (-not $cmd) {
    Write-Host "找不到 '$name'。請安裝 Node.js 22 LTS: winget install OpenJS.NodeJS.LTS" -ForegroundColor Yellow
    exit 1
  }
}

$major = [int]((node -v) -replace "^v", "").Split(".")[0]
if ($major -ge 24) {
  Write-Host "請改用 Node.js 22 LTS（目前為 Node $(node -v)）。Prisma 在 v24 常會安裝失敗。" -ForegroundColor Red
  exit 1
}

Remove-Item -Force .cursor-setup.log -ErrorAction SilentlyContinue
Log "== $(Get-Date) setup start =="
Require-Command node
Require-Command npm
Log "node: $(node -v)"
Log "npm: $(npm -v)"

Log "== npm install =="
npm install 2>&1 | Tee-Object -FilePath .cursor-npm-install.log -Append

Log "== prisma generate =="
npm run db:generate 2>&1 | Tee-Object -FilePath .cursor-prisma-generate.log -Append

Log "== prisma db push =="
npm run db:push 2>&1 | Tee-Object -FilePath .cursor-prisma-push.log -Append

Log "== db seed =="
npm run db:seed 2>&1 | Tee-Object -FilePath .cursor-db-seed.log -Append

Log "== setup done =="
