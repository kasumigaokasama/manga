#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

[[ -f app/backend/.env ]] || cp app/backend/.env.example app/backend/.env

echo "Building frontend + backend..."
npm run build

echo "Starting API (:3000) + serving dist (:4173)..."
npx concurrently -n api,web -c green,magenta "node app/backend/dist/main.js" "npx serve -s app/frontend/dist -l 4173"

