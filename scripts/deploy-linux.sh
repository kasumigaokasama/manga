#!/usr/bin/env bash
set -euo pipefail

# Simple local-build + remote-deploy helper for Linux/macOS hosts
# Prereqs: rsync, ssh (key auth recommended), npm/Node 20 on local; PM2+Nginx on server

SERVER="${SERVER:-}"           # e.g. user@your-server
REMOTE_DIST="${REMOTE_DIST:-/var/www/manga-shelf/dist}"
PM2_NAME="${PM2_NAME:-manga-shelf-api}"
NGINX_TEST="${NGINX_TEST:-sudo nginx -t}"
NGINX_RELOAD="${NGINX_RELOAD:-sudo systemctl reload nginx}"

usage() {
  cat <<EOF
Usage: SERVER=user@host [REMOTE_DIST=/var/www/manga-shelf/dist] ./scripts/deploy-linux.sh

Environment variables:
  SERVER       SSH target (user@host) — REQUIRED
  REMOTE_DIST  Remote web root for static files (default: /var/www/manga-shelf/dist)
  PM2_NAME     PM2 process name for API (default: manga-shelf-api)
  NGINX_TEST   Command to test nginx config (default: sudo nginx -t)
  NGINX_RELOAD Command to reload nginx (default: sudo systemctl reload nginx)

This script:
  1) Builds frontend + backend locally (npm run build)
  2) rsyncs dist/ to REMOTE_DIST
  3) Restarts API via PM2 and reloads nginx on the server
EOF
}

if [[ -z "$SERVER" ]]; then
  usage
  exit 1
fi

echo "[1/4] Building (frontend + backend)"
npm run build

echo "[2/4] Ensuring remote dist path: $REMOTE_DIST"
ssh "$SERVER" "sudo mkdir -p '$REMOTE_DIST' && sudo chown -R \$(id -un):\$(id -gn) '$REMOTE_DIST'"

echo "[3/4] Syncing frontend dist to server"
rsync -avh --delete app/frontend/dist/ "$SERVER:$REMOTE_DIST/"

echo "[4/4] Restarting API + reloading nginx"
ssh "$SERVER" "pm2 restart '$PM2_NAME' || pm2 start ecosystem.config.cjs && pm2 save"
ssh "$SERVER" "$NGINX_TEST && $NGINX_RELOAD"

echo "Deploy complete. Visit your site and hard-reload to refresh the Service Worker."
