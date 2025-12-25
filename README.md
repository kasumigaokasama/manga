# Manga Shelf — Private Books/Manga Shelf

Self-hosted monorepo for a private books/manga shelf.

- **Frontend**: Angular 18+ (Tailwind CSS, Glassmorphism UI)
- **Backend**: Node.js 20 + Express + TypeScript (SQLite via Kysely)
- **Formats**: PDF, EPUB, CBZ/ZIP, image-based ZIPs
- **Reader (Images)**: Manga-specific features (RTL, 1-up/2-up spread, gestures, 3D flips)
- **Reader (PDF)**: PDF.js with HTTP range streaming (instant viewing), zoom, fullscreen
- **Deploy**: Docker (Compose) or PM2 + Nginx (Ubuntu)

## Quick Start (Docker)

```bash
cd docker
docker-compose up -d --build
```
Access at `http://localhost:8888`. Default admin: `admin@example.com` / `changeme`

### Accessing via WLAN / Local Network

To access Manga Shelf from other devices (phone, tablet) in your WLAN:
1. Find your local IP address (open PowerShell, type `ipconfig`, and look for "IPv4 Address", e.g., `192.168.178.42`).
2. Open the browser on your other device and enter the URL: `http://<YOUR-IP>:8888`.
3. Ensure the Windows Firewall doesn't block port `8888`.
   - You can quickly allow the port with this PowerShell command (as Administrator):
     ```powershell
     New-NetFirewallRule -DisplayName "Manga Shelf" -Direction Inbound -LocalPort 8888 -Protocol TCP -Action Allow
     ```

## Quick Start (Manual)

Prereqs: Node 20.x. On Linux install `libvips-dev` and optionally `poppler-utils` for PDF covers.

```bash
npm i                         # installs workspaces
cp app/backend/.env.example app/backend/.env
npm run dev                   # Angular :4200, API :3000
```

## Features & UX

- **Smart Upload**: PDF, EPUB, CBZ/ZIP, image ZIP with automated cover & preview generation.
- **Library**: Advanced filters (format/tag/language), sorting, and infinite scroll.
- **Manga Reader**: 3D page flips, RTL support, 2-up spread mode, prefetching, and touch gestures.
- **PDF Reader**: Range-based streaming (starts instantly without full download), zoom, and fullscreen.
- **Themes**: Sakura (Day) with blossom animations and Night mode with starfields.
- **Offline support**: PWA with Service Worker caching for covers and recently read pages.

## Configuration

Adjust `app/backend/.env` as needed:

- `PORT`: API port (default 3000)
- `CORS_ORIGIN`: Allowed origin (default http://localhost:4200)
- `JWT_SECRET`: Secret for auth tokens
- `MAX_UPLOAD_MB`: Max file size for uploads (default 512)
- `STORAGE_DIR`: Path for assets (defaults to `storage/` in repo)

## Deployment

1. **Build**: `npm run build`
2. **PM2**: `pm2 start ecosystem.config.cjs`
3. **Nginx**: See `docs/nginx.example.conf`.
4. **HTTPS**: `sudo certbot --nginx -d your-domain`

## Troubleshooting

- **502/504**: Check PM2/Docker logs.
- **413 Payload Too Large**: Increase `client_max_body_size` in Nginx config.
- **Permissions**: Ensure `storage/` is writable.
- **PDF Covers**: Install `poppler-utils` for `pdftoppm`.

## Security

- Keep the repository private.
- Change the default admin password immediately.
- Use a VPN or restricted firewall for production access.

---

Detailed documentation can be found in the `docs/` folder:
- [Development Guide](docs/DEV.md)
- [Publishing/Deployment](docs/PUBLISHING.md)
- [QA Checklist](docs/QA-CHECKLIST.md)
