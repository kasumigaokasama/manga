Param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Push-Location $PSScriptRoot\..

if (-Not (Test-Path 'app/backend/.env')) {
  Copy-Item 'app/backend/.env.example' 'app/backend/.env'
}

Write-Host 'Installing workspace tools (root)...' -ForegroundColor Cyan
npm i

Write-Host 'Installing dependencies (backend)...' -ForegroundColor Cyan
pushd app/backend; npm i; popd
Write-Host 'Installing dependencies (frontend)...' -ForegroundColor Cyan
pushd app/frontend; npm i; popd

Write-Host 'Freeing default dev ports (3001, 4300) if needed...' -ForegroundColor Yellow
try { Get-NetTCPConnection -LocalPort 3001,4300 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique | ForEach-Object { Stop-Process -Id $_ -Force } } catch {}

Write-Host 'Starting dev (frontend :4300 + backend :3001)...' -ForegroundColor Green
# Use npx to avoid PATH issues if binaries are not linked yet
npx concurrently -n api,web -c green,magenta "npx cross-env-shell PORT=3001 npm run dev -w app/backend" "npm exec -w app/frontend -- ng serve --port 4300"

Pop-Location

# Keep the window open if started by double-click or if the process exits
Write-Host "`n[local-dev] Dev processes exited (or were stopped)." -ForegroundColor Yellow
try { Read-Host 'Press Enter to close this window'; } catch {}
