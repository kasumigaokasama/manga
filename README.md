# Manga Shelf – Privates Bücher/Manga-Regal

Selbstgehostetes Monorepo für dein privates Bücher- und Manga-Regal. Frontend: **Angular v20** mit Tailwind & Angular Material. Backend: **Node.js 20 + Express + TypeScript** auf SQLite (Kysely). Features: Upload (PDF/EPUB/CBZ/Bilder-ZIP), Sakura/Manga-Theme, PDF.js-Reader, Manga-Reader (RTL, 2-up, Gesten), Lesefortschritt via JWT. Deployment per **PM2 + Nginx + Let’s Encrypt** auf Ubuntu.

---

## 1) Voraussetzungen

| Komponente | Hinweise |
| --- | --- |
| Hardware | z. B. ThinkPad/NUC mit Ubuntu Server 24.04 LTS, 4 GB RAM, SSD |
| OS/Tools | `sudo apt update && sudo apt install -y git curl build-essential nginx python3-pip` |
| Node.js | Node 20.x (z. B. via `curl -fsSL https://deb.nodesource.com/setup_20.x \| sudo -E bash -`, danach `sudo apt install nodejs`). Hinweis: `.nvmrc` pinnt Node 20 — `nvm use` wählt die richtige Version. |
| PM2 | `sudo npm install -g pm2` |
| SQLite & Bildverarbeitung | `sudo apt install -y sqlite3 libvips-dev` (für `sharp`), `sudo apt install -y poppler-utils` (pdftoppm für PDF-Cover) |
| SSH | Zugriff z. B. `ssh user@dein-server` |

> **Wichtig:** `better-sqlite3` kompiliert native Addons. Stelle sicher, dass `build-essential` und `python3` installiert sind.

## 2) Projekt holen & installieren

```bash
git clone <REPO_URL> manga-shelf
cd manga-shelf

# Backend
cd app/backend
npm install
cp .env.example .env
cd ../../

# Frontend
cd app/frontend
npm install
cd ../../

# Entwicklung
npm run dev   # http://localhost:4200 (Angular) + http://localhost:3000 (API)

# Tests (Backend)
npm run test         # vitest (Unit + E2E)
npm run test:unit
npm run test:e2e

# Produktionsbuild
npm run build        # erstellt app/frontend/dist & app/backend/dist

# PM2 (Produktion)
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup          # erzeugt systemd-Service (Befehl ausführen)
```

Standard-Accounts nach Seed (`npm run dev`/`npm run build` führt Migration+Seed aus):

| Rolle | Login |
| --- | --- |
| Admin | `admin@example.com` / `ChangeThis123!` |
| Leser | `friend1@example.com` / `ChangeThis123!`, `friend2@example.com` / `ChangeThis123!` |

## 3) Nginx einrichten

1. Angular-Build auf Server kopieren (vom lokalen Rechner):
   ```bash
   rsync -avh --delete app/frontend/dist/ user@server:/var/www/manga-shelf/dist/
   ```
2. Beispiel-VHost übernehmen (`docs/nginx.example.conf`):
   ```bash
   sudo mkdir -p /var/www/manga-shelf/dist
   sudo cp docs/nginx.example.conf /etc/nginx/sites-available/manga-shelf
   sudo ln -s /etc/nginx/sites-available/manga-shelf /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```
3. `client_max_body_size` ggf. in der Server- oder http-Section ergänzen (z. B. `client_max_body_size 1G;`) falls große Uploads.

## 4) Domain (GoDaddy)

1. Öffentliche IP ermitteln: `curl ifconfig.me`
2. Im GoDaddy-Dashboard A-Records für `@` und `www` auf die öffentliche IPv4 setzen.
3. Hinweis: Bei DS-Lite/CGNAT erreichst du keine öffentliche IPv4. Alternativen: Dual-Stack buchen, Cloudflare Tunnel oder Tailscale/Syncthing für privaten Zugriff.

## 5) HTTPS (Let’s Encrypt)

```bash
sudo certbot --nginx -d deine-domain.tld -d www.deine-domain.tld
sudo systemctl reload nginx
```

Certbot aktualisiert die Nginx-Konfiguration automatisch. Erneuere Zertifikate per `sudo certbot renew --dry-run` testen.

## 6) Zugang beschränken – zwei Wege

### A) Nginx Basic Auth (optional, zusätzlicher Schutz)

```bash
sudo apt install apache2-utils
sudo htpasswd -c /etc/nginx/.mangashelf_users <BENUTZERNAME>
# In docs/nginx.example.conf die auth_basic-Zeilen einkommentieren
sudo nginx -t && sudo systemctl reload nginx
```

### B) App-Login (JWT)

* Login unter `/login` (Token in `localStorage`), Logout-Button in der Toolbar.
* Rollen: `admin` (Upload/Userverwaltung), `editor` (Upload), `reader` (nur Lesen).
* Passwort ändern unter `/settings` → „Passwort ändern“ (API: `PATCH /api/account/password`).

## 7) Upload & Nutzung

**Storage-Layout (`/storage`):**

```
storage/
  originals/   # Originaldateien (PDF/EPUB/CBZ/ZIP)
  pages/       # extrahierte Seitenbilder
  thumbnails/  # 256px Cover
  previews/    # 1024px Vorschau
  db/          # SQLite DB + Audit-Log
```

* Upload-Formular (`/upload`): Drag & Drop, Fortschrittsbalken, Tags, Sprache.
* API prüft Magic-Bytes, generiert Cover + Preview (PDF via `pdftoppm`, CBZ via `sharp`).
* Reader (`/reader/:id`):
  - **PDF:** PDF.js mit Range-Streaming, Zoom, Vollbild.
  - **EPUB:** Als Download ausgeliefert (GET `/api/books/:id/download`, setzt Content-Disposition).
  - **HEAD:** `HEAD /api/books/:id/stream` liefert `Content-Length`, `Content-Type` und `Accept-Ranges`.
  - **Manga:** Bild-Scroller, Standard **RTL**, Spread (2-up), Zoom, Gesten (Swipe). Fortschritt wird alle 400 ms synchronisiert.
  - **Keybindings:** ←/→ Seitenwechsel (RTL respektiert), `[`/`]` Zoom, `F` Fullscreen, `R` Richtung, `S` Spread, `D` Sakura/Night Toggle.
* Settings: Sakura-Blüten, Canvas-Dichte, Sternenhimmel (Night), Standard-Leserichtung/-Spread, dezente Sounds.

## 8) DynDNS (GoDaddy-DDNS)

Skript: `docs/godaddy-ddns/update.sh`

```bash
chmod +x docs/godaddy-ddns/update.sh
DOMAIN="example.com" KEY="<API_KEY>" SECRET="<API_SECRET>" ./docs/godaddy-ddns/update.sh
```

Cronjob alle 5 Minuten (als root):

```
*/5 * * * * /pfad/zur/repo/docs/godaddy-ddns/update.sh >> /var/log/godaddy-ddns.log 2>&1
```

## 9) Backups

Beispielskript: `docs/backup.example.sh` (tar.gz aller Speicherordner). Ausführbar machen und per Cron laufen lassen:

```bash
chmod +x docs/backup.example.sh
30 3 * * * /pfad/zur/repo/docs/backup.example.sh >> /var/log/manga-backup.log 2>&1
```

Backups sicher extern ablegen (NAS/Cloud). Zusätzlich Git-Repo regelmäßig pullen.

## 10) Power & Recovery

* **BIOS**: „After Power Loss: Power On“ aktivieren, damit der Server nach Stromausfall selbst startet.
* **PM2**: `pm2 save` + `pm2 startup` ausführen → automatischer Neustart des Node-Backends.
* **USV** optional für sauberes Herunterfahren bei längeren Ausfällen.

## 11) Energiesparen (ThinkPad-Beispiel)

* `sudo apt install tlp tlp-rdw` → `sudo tlp start`
* `sudo powertop --auto-tune` (ggf. per systemd-Service automatisieren)
* SSD/PCIe-Power-Management aktivieren, nicht benötigte Dienste deaktivieren
* Ziel: <20 W Idle (je nach Hardware)

## 12) Troubleshooting

| Problem | Lösung |
| --- | --- |
| **502 / 504 Gateway** | Prüfen, ob PM2-Process läuft (`pm2 status`), Logs ansehen (`pm2 logs manga-shelf-api`). |
| **413 Payload Too Large** | `client_max_body_size` in Nginx erhöhen (siehe Abschnitt 3). |
| **CORS-Fehler lokal** | `.env` → `CORS_ORIGIN=http://localhost:4200` setzen. |
| **Berechtigungen** | Ordner `storage/*` gehören dem Laufzeituser (`chown -R user:user storage`). |
| **pdftoppm nicht gefunden** | `sudo apt install poppler-utils`. |
| **sharp-Build schlägt fehl** | `libvips-dev` installieren und `npm rebuild sharp`. |
| **SQLite locked** | Prozess beendet? PM2-Neustart (`pm2 restart manga-shelf-api`). |

Logs:
* Backend: `pm2 logs manga-shelf-api`
* Frontend-Serve (optional): `pm2 logs manga-shelf-web`
* Nginx: `/var/log/nginx/access.log`, `/var/log/nginx/error.log`

## 13) Security-Hinweise

* Repository **privat halten**, keine öffentlichen Uploads.
* Starke Passwörter verwenden, Admin-Account nach Setup ändern.
* Optional 2-Faktor (z. B. über zusätzliche Reverse-Proxy-Layer, VPN, Tailscale).
* Regelmäßige Updates: `sudo apt upgrade`, `npm outdated` prüfen.
* SQLite-Backups verschlüsseln (z. B. `gpg`), Server-Firewall aktivieren (`ufw allow 22 80 443`).

## 14) Footer-Rechtstext

> „Nur für eigene, legal erworbene Bücher/Mangas. Keine öffentliche Verbreitung.“

---

### Weitere Ressourcen

* **Nginx-Beispiel:** `docs/nginx.example.conf`
* **DynDNS:** `docs/godaddy-ddns/update.sh`
* **Backup-Skript:** `docs/backup.example.sh`
* **PM2-Konfiguration:** `ecosystem.config.cjs`
* **.env Vorlage:** `app/backend/.env.example`
* **Dev-Setup (Windows/WSL/Linux):** `docs/DEV.md`
* **Publishing (Ubuntu + Nginx + PM2):** `docs/PUBLISHING.md`

### Dev/Build-Skripte (Root `package.json`)

| Skript | Beschreibung |
| --- | --- |
| `npm run dev` | `ng serve` + `ts-node` via `concurrently` |
| `npm run build` | `ng build --configuration production` + `tsc` |
| `npm run start` | Startet Backend (`node app/backend/dist/main.js`) |
| `npm run test` | Führt Backend-Tests (vitest) aus |

Viel Spaß beim Lesen unter Kirschblüten! 🌸
