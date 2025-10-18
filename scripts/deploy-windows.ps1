Param(
  [Parameter(Mandatory=$true)][string]$Server,           # e.g. user@your-server
  [string]$RemoteDist = "/var/www/manga-shelf/dist",
  [string]$Pm2Name = "manga-shelf-api",
  [string]$KeyPath = "",                                 # optional: path to private key
  [switch]$RemoteBuild                                   # optional: build on server using repo
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Exec($cmd){
  Write-Host "`n> $cmd" -ForegroundColor Cyan
  iex $cmd
}

function Scp($src, $dst){
  if ($KeyPath) { Exec "scp -i `"$KeyPath`" -r $src $dst" }
  else { Exec "scp -r $src $dst" }
}

function Ssh($command){
  if ($KeyPath) { Exec "ssh -i `"$KeyPath`" $Server `$'$command`'" }
  else { Exec "ssh $Server `$'$command`'" }
}

if (-not $RemoteBuild){
  Write-Host "[1/5] Building locally (frontend + backend)" -ForegroundColor Green
  Exec "npm run build"

  $zip = Join-Path $PWD "dist.zip"
  if (Test-Path $zip) { Remove-Item $zip -Force }
  Write-Host "[2/5] Zipping frontend dist" -ForegroundColor Green
  Compress-Archive -Path "app/frontend/dist/*" -DestinationPath $zip

  Write-Host "[3/5] Uploading dist to server" -ForegroundColor Green
  Scp $zip "$Server:/tmp/manga-dist.zip"

  Write-Host "[4/5] Installing dist on server" -ForegroundColor Green
  Ssh "sudo mkdir -p $RemoteDist && sudo rm -rf $RemoteDist/* && sudo unzip -o /tmp/manga-dist.zip -d $RemoteDist && rm -f /tmp/manga-dist.zip"
}
else {
  Write-Host "[1/3] Building on server (git pull + build)" -ForegroundColor Green
  Ssh "set -e; if [ -d manga ]; then cd manga && git pull; else echo 'Repo path unknown. Clone/update manually.'; fi; npm ci; npm run build; sudo mkdir -p $RemoteDist; sudo rsync -avh --delete app/frontend/dist/ $RemoteDist/"
}

Write-Host "[5/5] Restarting API + reloading nginx" -ForegroundColor Green
Ssh "pm2 restart $Pm2Name || pm2 start ecosystem.config.cjs && pm2 save"
Ssh "sudo nginx -t && sudo systemctl reload nginx"

Write-Host "Done. Tip: Hard-reload in the browser to refresh the Service Worker." -ForegroundColor Green

