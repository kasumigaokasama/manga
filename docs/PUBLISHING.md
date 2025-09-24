Publishing Guide

This guide walks you through building and deploying Manga Shelf on a fresh Ubuntu 24.04 server behind Nginx with PM2.

Prerequisites

- Ubuntu 24.04 server with sudo access
- Domain name pointing at the server (A records)
- Email address for Let’s Encrypt

Install base packages

```
sudo apt update
sudo apt install -y git curl build-essential nginx python3-pip sqlite3 libvips-dev poppler-utils
```

Install Node 20 (recommended via nvm)

```
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.nvm/nvm.sh
nvm install 20
nvm use 20
```

Clone and build

```
git clone <REPO_URL> manga-shelf
cd manga-shelf
nvm use              # picks Node 20 per .nvmrc
cp app/backend/.env.example app/backend/.env
# Edit app/backend/.env: set JWT_SECRET, CORS_ORIGIN=https://your-domain.tld

npm i
npm run build        # builds API + Angular
```

Run with PM2

```
sudo npm i -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup         # follow systemd instructions
```

Nginx (static SPA + reverse proxy to API)

```
sudo mkdir -p /var/www/manga-shelf/dist
sudo rsync -avh --delete app/frontend/dist/ /var/www/manga-shelf/dist/
sudo cp docs/nginx.example.conf /etc/nginx/sites-available/manga-shelf
sudo ln -s /etc/nginx/sites-available/manga-shelf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

TLS (Let’s Encrypt)

```
sudo snap install core; sudo snap refresh core
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
sudo certbot --nginx -d your-domain.tld -d www.your-domain.tld
sudo systemctl reload nginx
```

Post‑deploy checks

- https://your-domain.tld opens the Angular app
- Login with admin@example.com / ChangeThis123! (change afterwards)
- Upload a CBZ/PDF/EPUB
  - Covers/previews appear
  - Reader opens
  - EPUB uses download via /api/books/:id/download
- API health: https://your-domain.tld/api/health → { ok: true }

Operations

- Update app:
  - `cd manga-shelf && git pull && npm i && npm run build && pm2 restart all`
- Logs:
  - `pm2 logs manga-shelf-api`
  - Nginx: `/var/log/nginx/access.log`, `/var/log/nginx/error.log`
- Backups:
  - See docs/backup.example.sh; back up `storage/*` (originals, pages, thumbnails, previews, db, audit.log)
- Large uploads:
  - If needed, set `client_max_body_size 1G;` in the Nginx server/http block.

Security

- Keep repo private; rotate default admin credentials
- Use strong `JWT_SECRET` in .env
- Limit exposure (VPN/allow‑list), consider Basic Auth on Nginx for an extra layer

