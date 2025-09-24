Developer Setup

Quick notes to get the repo running locally across common environments.

Node version

- Target Node 20.x (LTS). A file `.nvmrc` at the repo root pins `20`.
- macOS/Linux: `nvm use` (or `fnm use`) in the repo will select Node 20.
- Windows: prefer using `nvm-windows` or run under WSL for a smoother native build experience.

Windows specifics (native addons)

Some dependencies (e.g., `better-sqlite3`, `sharp`) compile native code when prebuilt binaries are unavailable. On Windows, ensure these are installed:

- Python 3.x (in PATH)
- Visual Studio Build Tools 2022 (C++ workload)
- Optionally set: `npm config set msvs_version 2022`

Then install:

```
npm i
```

If you still hit build issues, prefer using WSL (Ubuntu) with the Linux prerequisites below.

Linux prerequisites (Ubuntu/Debian)

```
sudo apt update
sudo apt install -y build-essential python3 libvips-dev poppler-utils sqlite3
```

Then:

```
npm i
npm run dev      # Angular :4200, API :3000
npm run test     # Backend Vitest suite
```

Notes

- The backend uses SQLite via `better-sqlite3`; it attempts to use prebuilt binaries, but will fall back to a local build.
- If you upgrade Node beyond 20, ensure your environment can compile native addons or that prebuilt binaries are available for your Node version.
- Storage directories are created on API start under `storage/` (or `STORAGE_DIR`).

