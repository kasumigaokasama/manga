# Manga Shelf — Private Books/Manga Shelf

Self‑hosted monorepo for a private books/manga shelf.

- Frontend: Angular 20 (Tailwind, Angular Material)
- Backend: Node.js 20 + Express + TypeScript (SQLite via Kysely)
- Formats: PDF, EPUB, CBZ/ZIP, image ZIP
- - Readers: Manga (RTL, 1-up/2-up, gestures) and PDF.js (range streaming)
- Deploy: PM2 + Nginx + Let’s Encrypt on Ubuntu

## Quick Start (macOS/Linux)

Prereqs: Node 20.x. On Linux install `libvips-dev` and optionally `poppler-utils` for PDF covers.

```
npm i                         # installs workspaces (frontend + backend)
cp app/backend/.env.example app/backend/.env
npm run dev                   # Angular :4200, API :3000
```

Tests (backend): `npm test`

Production build and API start:

```
npm run build                 # builds frontend + backend
npm run start                 # API: node app/backend/dist/main.js
```

## Features & UX

- Upload: PDF, EPUB, CBZ/ZIP, image ZIP with cover/preview generation
- Library: filters (format/tag/language), sorting, download original, infinite scroll
- Reader – images (manga): RTL, 1‑up/2‑up (spread), zoom, pointer gestures, prefetch
- Reader � PDF: In-browser PDF.js with range streaming (no download), zoom, fullscreen, prefetch
- Themes: Sakura (petals) and Night (stars), Minimal preset
- Offline: SW caches covers/previews (30d) and reader pages (7d); optional offline badge
- A11y: focus outlines, ARIA labels

## Configuration

Copy `app/backend/.env.example` to `.env` and adjust as needed:

- `PORT` (default 3000)
- `CORS_ORIGIN` (default http://localhost:4200)
- `JWT_SECRET` (change in production)
- `MAX_UPLOAD_MB` (default 512)
- `STORAGE_DIR` (optional absolute path; otherwise `storage/` in repo)

Storage layout under `storage/`:

```
storage/
  originals/   # uploaded originals (PDF/EPUB/CBZ/ZIP)
  pages/       # extracted images
  thumbnails/  # small covers (256px)
  previews/    # large previews (1024px)
  db/          # SQLite database + audit
```

## Development

Common commands (root `package.json`):

- `npm run dev` – runs `ng serve` and backend (tsc watch + nodemon) concurrently
- `npm run build` – `ng build --configuration production` + `tsc`
- `npm run start` – starts API (`node app/backend/dist/main.js`)
- `npm run test` – runs backend Vitest suite

Windows notes: native addons (better‑sqlite3, sharp) may require Python 3 and VS Build Tools 2022. Prefer WSL if setup is troublesome. See `docs/DEV.md`.

## Deployment (PM2 + Nginx)

1) Build locally: `npm run build`

2) Copy Angular dist to server (example):

```
rsync -avh --delete app/frontend/dist/ user@server:/var/www/manga-shelf/dist/
```

3) Start API with PM2 on server:

```
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

4) Configure Nginx. See `docs/nginx.example.conf`. Increase `client_max_body_size` for large uploads.

5) HTTPS via Let’s Encrypt: `sudo certbot --nginx -d your-domain -d www.your-domain`

## Troubleshooting

- 502/504: Check PM2 status (`pm2 status`) and logs (`pm2 logs manga-shelf-api`).
- 413 Payload Too Large: Increase `client_max_body_size` in Nginx.
- CORS during dev: set `CORS_ORIGIN=http://localhost:4200` in backend `.env`.
- Permissions: ensure `storage/*` is writable by the runtime user.
- `pdftoppm` missing: install `poppler-utils` to generate PDF covers; PDF reading still works without covers.
- `sharp` build errors: install `libvips-dev` and try `npm rebuild sharp`.

## Security

- Keep the repository private; do not expose uploads publicly.
- Change default admin password after setup; use strong passwords.
- Keep system and dependencies updated (`sudo apt upgrade`, `npm outdated`).
- Encrypt backups and restrict server access (firewall/VPN).

---

More docs: `docs/DEV.md`, `docs/PUBLISHING.md`, `docs/QA-CHECKLIST.md`, `docs/nginx.example.conf`.


Windows:

``
npm i
copy app\backend\.env.example app\backend\.env
npm run dev:win   # API :3001, Web :4300
``


