Manga Shelf — QA Smoke Test Checklist

Environment

- Build frontend and backend: `npm run build` at repo root
- Start backend: `npm run start` (or via PM2)
- Serve frontend build via Nginx or `ng serve` for dev

Flows

- Auth
  - Login with admin credentials (toolbar shows email + role)
  - Logout works and clears token
- Upload
  - Upload a small PDF and a CBZ; progress bar advances; toast on success
  - Library lists new items; covers render (or "Kein Cover" shown)
- Library
  - Filters: format, tag, language; Sort: createdAt/title/updatedAt
  - Download "Original" link works (token embedded)
  - Options menu opens/closes; Delete visible for admin/editor and works
- Reader (Images/Manga)
  - Open item; RTL respected, Spread toggle works; Zoom via +/- and `[`/`]`
  - Keyboard arrows navigate; `F` fullscreen; `R` toggles RTL; `S` spread; `D` theme
  - Prefetch next pages (network shows next images requested)
- Reader (PDF)
  - PDF renders via in-browser PDF.js (no download); zoom works; page slider scrubs; prefetch warms next page
- Settings
  - Theme presets (Sakura Day/Night/Minimal) switch classes and canvases
  - Blossoms density/speed change effect; Starfield toggles in Night
  - Reader defaults (RTL/Spread) persist and affect new sessions
  - Offline badge toggle shows/hides "offline" on cached covers
  - Aggressive prefetch toggle increases look-ahead to 2 pages
  - Password change flow yields success toast (requires valid backend)
- Offline & SW
  - Visit Library and Reader pages (to seed SW cache)
  - Go offline: offline badge appears in toolbar and covers (if enabled)
  - Navigate Reader to cached pages successfully offline
- A11y
  - Keyboard tab order sensible; focus outline visible
  - Buttons/selects have meaningful aria-labels

Admin

- Create a user; list refreshes
- Change role; Delete user; Audit events update

Notes

- Covers/reader pages are cached with bounded policies (30d/7d)
- Aggressive prefetch is configurable to balance bandwidth vs. speed

