#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

[[ -f app/backend/.env ]] || cp app/backend/.env.example app/backend/.env

echo "Installing backend deps..."
(cd app/backend && npm i)
echo "Installing frontend deps..."
(cd app/frontend && npm i)

echo "Starting dev (frontend :4200 + backend :3000)..."
npm run dev

