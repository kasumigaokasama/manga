Param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Push-Location $PSScriptRoot\..

if (-Not (Test-Path 'app/backend/.env')) {
  Copy-Item 'app/backend/.env.example' 'app/backend/.env'
}

Write-Host 'Building frontend + backend...' -ForegroundColor Cyan
npm run build

Write-Host 'Starting API (:3000) + serving dist (:4173)...' -ForegroundColor Green
npx concurrently -n api,web -c green,magenta "node app/backend/dist/main.js" "npx serve -s app/frontend/dist -l 4173"

Pop-Location

