# Parse 政府採購法規全部題庫.pdf → JSON → PostgreSQL
Set-Location $PSScriptRoot\..

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

$logDir = "data\question-bank"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir "_agent-run.log"

function Log($t) {
  $line = "$(Get-Date -Format 'o') $t"
  Write-Host $line
  Add-Content -Path $log -Value $line -Encoding utf8
}

Remove-Item $log -ErrorAction SilentlyContinue
Log "npm install"
npm install 2>&1 | ForEach-Object { Log $_ }

Log "parser unit test"
npx tsx scripts/lib/parse-question-bank-text.test.ts 2>&1 | ForEach-Object { Log $_ }
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$pdfItem = Get-ChildItem -Path (Get-Location) -Filter "*題庫*.pdf" -File -ErrorAction SilentlyContinue |
  Select-Object -First 1
if ($pdfItem) {
  Log "PDF found: $($pdfItem.Name) ($($pdfItem.Length) bytes)"
  Log "parse PDF"
  npx tsx scripts/parse-question-bank-pdf.ts --pdf $pdfItem.FullName 2>&1 | ForEach-Object { Log $_ }
} else {
  Log "WARN: no *題庫*.pdf in project root; using Node default path resolver"
  Log "parse PDF"
  npx tsx scripts/parse-question-bank-pdf.ts 2>&1 | ForEach-Object { Log $_ }
}
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Log "import to DB"
npx tsx scripts/import-question-bank.ts 2>&1 | ForEach-Object { Log $_ }
exit $LASTEXITCODE
