Param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Push-Location $PSScriptRoot\..

if (-Not (Test-Path 'app/backend/.env')) {
  Copy-Item 'app/backend/.env.example' 'app/backend/.env'
}

Write-Host 'Installing dependencies (backend)...' -ForegroundColor Cyan
pushd app/backend; npm i; popd
Write-Host 'Installing dependencies (frontend)...' -ForegroundColor Cyan
pushd app/frontend; npm i; popd

Write-Host 'Starting dev (frontend :4200 + backend :3000)...' -ForegroundColor Green
npm run dev

Pop-Location

