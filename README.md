# Manga Shelf – Privates Bücher/Manga-Regal (Monorepo)

Privates, selbstgehostetes Bücher/Manga-Regal. Frontend: Angular v20 (Standalone, Tailwind, Angular Material – Sakura-Toolbar). Backend: Node 20, Express, TypeScript, SQLite (Kysely). Upload (PDF/EPUB/CBZ/JPG-Ordner), Bibliothek, Reader (PDF.js & Manga-Images), JWT-Login. Deployment: PM2, Nginx, Let’s Encrypt. Nur für dich & Freunde.

## 1) Voraussetzungen
- Ubuntu Server 24.04 (oder lokal), SSH, Node.js 20, npm, Nginx, PM2, Git
- SSH Basics: `ssh user@server` (Port ggf. `-p 22`)

## 2) Projekt holen & installieren
```bash
# Klonen
git clone <REPO_URL> manga-shelf && cd manga-shelf

# Abhängigkeiten
cd app/backend && npm i && cd -
cd app/frontend && npm i && cd -

# Env
cp app/backend/.env.example app/backend/.env

# Entwicklung starten
npm run dev   # Frontend http://localhost:4200, Backend http://localhost:3000

# Produktionsbuild
npm run build # erzeugt: app/frontend/dist + app/backend/dist
```
Standard-Login (Seed): `adminexample.com` / `ChangeThis123!`

## 3) Nginx einrichten
- Angular Dist kopieren: `sudo rsync -avh --delete app/frontend/dist/ /var/www/manga-shelf/dist/`
- VHost aus `docs/nginx.example.conf` anpassen → `/etc/nginx/sites-available/manga-shelf`
```bash
sudo ln -s /etc/nginx/sites-available/manga-shelf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 4) Domain (GoDaddy)
- A-Records `@` und `www` auf öffentliche IPv4 (`curl ifconfig.me`).
- DS-Lite/CGNAT Hinweis: ggf. Dual-Stack buchen oder Tailscale als Alternative.

## 5) HTTPS (Let’s Encrypt)
```bash
sudo certbot --nginx -d deine-domain.tld -d www.deine-domain.tld
```

## 6) Zugang beschränken
- A) Nginx Basic Auth (optional):
```bash
sudo apt install apache2-utils
sudo htpasswd -c /etc/nginx/.mangashelf_users <name>
# Direktiven in nginx.example.conf aktivieren, nginx neu laden
```
- B) App-Login (JWT): Login-Seite, Rollen (admin/editor/reader), Logout; Token lokal gespeichert.
  - Passwort ändern: Seite „Einstellungen“ enthält Formular (aktuell + neu). API: `PATCH /api/account/password`.

## 7) Upload & Nutzung
- Speicherorte: `storage/originals`, `storage/pages`, `storage/thumbnails`, `storage/previews`, `storage/db`.
- Große Uploads: Nginx `client_max_body_size 1G;` setzen, falls 413.
- PDF-Cover: Für Thumbnails `poppler-utils` (pdftoppm) installieren (siehe Kommentar im Code).
- Reader: PDF inline mit pdf.js; Manga-Viewer mit RTL/LTR, 2‑up, Zoom, Fullscreen, Swipe. Fortschritt wird synchronisiert.

## 8) DynDNS (GoDaddy DDNS)
- `docs/godaddy-ddns/update.sh` anpassen (`DOMAIN`, `KEY`, `SECRET`), ausführbar: `chmod +x docs/godaddy-ddns/update.sh`.
- Cron: `*/5 * * * * /path/to/docs/godaddy-ddns/update.sh >> /var/log/godaddy-ddns.log 2>&1`

## 9) Betrieb (PM2)
```bash
npm run build
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup
```

## 10) Backups
- Beispielskript: `docs/backup.example.sh` anpassen. Täglich 03:30: `30 3 * * * /path/to/docs/backup.example.sh`

## 11) Troubleshooting
- 502/504: API down? `pm2 logs manga-shelf-api`
- 413: `client_max_body_size` erhöhen.
- CORS: `CORS_ORIGIN` in `.env` anpassen.
- Rechte: Schreibrechte für `storage/*` sicherstellen.

## Admin-Header-Token (Optional)
- Setze `ADMIN_TOKEN` in `app/backend/.env`. Dann sind Upload/DELETE zusätzlich über `X-Admin-Token: <token>` erlaubt (praktisch für Skripte). JWT-Auth bleibt weiterhin aktiv.

## 12) Sicherheit & Rechtstext
- Privat halten, starke Passwörter, keine Secrets committen.
> „Nur für eigene, legal erworbene Bücher/Mangas. Keine öffentliche Verbreitung.“

---
- API: `/api/auth/login`, `/api/auth/me`, `/api/books/*` (Upload, List, Stream, Pages, Progress)
- Mitgeliefert: `docs/nginx.example.conf`, `docs/godaddy-ddns/update.sh`, `.env.example`, `ecosystem.config.cjs`.

## Quick‑Checklist (lokal testen)
- `npm run dev` → Frontend http://localhost:4200, Backend http://localhost:3000
- Login: `adminexample.com` / `ChangeThis123!`
- Upload: kleine CBZ → Bibliothek zeigt Cover → Reader öffnet Bilder
- PDF: Upload → `Reader` verlinkt Stream, Scrubber sichtbar
- Progress: Seite wechseln → neu laden → Position bleibt
- Theme: Toolbar „Theme ▾“ → Presets (Sakura Day/Night/Minimal) testen
- Blossoms: Settings → Sakura/Blüten aktivieren, Dichte/Speed regeln
- Night: Schalte auf Night (Sakura aus) → Starfield sichtbar, Sternen‑Dichte regeln

### Skripte (lokal)
- Windows (PowerShell)
  - Dev: `scripts/local-dev.ps1`
  - Prod-like: `scripts/local-prod.ps1`
- Linux/macOS (Bash)
  - Dev: `scripts/local-dev.sh`
  - Prod-like: `scripts/local-prod.sh`

### Sample CBZ erzeugen
- `node app/backend/scripts/make-sample-cbz.mjs` → erzeugt `sample.cbz` im Repo-Root.

## Night Theme & Effekte verifizieren
1) In der Toolbar „Theme ▾“ → „Night“ wählen.
2) Prüfe:
   - Sternenhimmel aktiv (dezent, twinkling) und UI gut lesbar
   - Karten/Toolbar im Dark‑Style, Links in ruhigem Blau
3) Optional: deaktiviere Sternenhimmel per Toggle oder ändere Dichte.
4) Wechsel auf „Sakura Day“ → Blüten sichtbar; Dichte/Speed in Settings steuerbar.
5) Login/Upload: kurze Petal‑Bursts; in Settings Sound optional aktivierbar (lautstärke sehr niedrig).

## Admin
- UI: Seite `/admin` (nur admin) zum Anlegen von Nutzern.
- API Beispiele:
```bash
# Login
curl -s http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"adminexample.com","password":"ChangeThis123!"}'

# Create user (admin JWT)
curl -s http://localhost:3000/api/users \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"email":"friend3example.com","password":"ChangeThis123!","role":"reader"}'
```
- Audit: `/api/audit?limit=200` (nur admin) oder UI im Admin-Bereich; Log-Datei `storage/db/audit.log` (JSON Lines).
