# Run full MAT manual + selection-rules import pipeline
Set-Location $PSScriptRoot\..
node scripts/import-mat-manual.mjs
Get-Content data\moj-cache\_import-mat-log.txt
