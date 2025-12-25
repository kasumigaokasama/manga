# Repository Guidelines

## Project Structure & Module Organization
- Source lives in `src/` with logical subfolders per domain (e.g., `src/api/`, `src/ui/`).
- Tests mirror source in `tests/` (e.g., `src/utils/date.ts` → `tests/utils/date.spec.ts` or `src/utils/date.py` → `tests/utils/test_date.py`).
- Executable scripts go in `scripts/`; static assets in `assets/` or `public/`.
- Configuration stays at the root (e.g., `.env.example`, `pyproject.toml`, `package.json`, `eslint.config.*`).

## Build, Test, and Development Commands
- Node/TypeScript
  - `npm i` (or `pnpm i`) — install dependencies.
  - `npm run dev` — start local dev server or watcher.
  - `npm test` ” run unit tests.
  - `npm run build` ” create production build.
- Python
  - `python -m venv .venv; . .venv/Scripts/Activate.ps1` — create/activate venv (PowerShell).
  - `pip install -r requirements.txt` — install dependencies.
  - `pytest -q` — run tests.
  - `python -m <package>` — run the app/module.

## Coding Style & Naming Conventions
- Indentation: JS/TS 2 spaces; Python 4 spaces.
- Names: `camelCase` functions/vars, `PascalCase` classes, `snake_case` Python files, `kebab-case` web asset files.
- Lint/format: JS/TS via ESLint + Prettier; Python via Black + isort + Flake8. Run `npm run lint` or `ruff/flake8` equivalents if configured.

## Testing Guidelines
- Frameworks: Jest/Vitest for JS/TS; Pytest for Python. Aim for ≥80% coverage on changed code.
- Naming: JS/TS `*.spec.ts|js`; Python `test_*.py`. Place tests next to or mirroring sources under `tests/`.
- Run fast, isolated unit tests by default; add integration tests where external boundaries exist.

## Commit & Pull Request Guidelines
- Use Conventional Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `ci:`.
- Keep commits focused and small; include tests and updated docs.
- PRs must include: clear description, linked issues (e.g., `Closes #123`), screenshots for UI changes, and passing CI.

## Security & Configuration Tips
- Never commit secrets; use `.env` and keep a synced `.env.example` with safe defaults.
- Prefer least-privilege API tokens; review dependency changes in PRs.
- Rotate keys on disclosure; document security practices in `SECURITY.md` if present.


Project notes:
- Angular runs zoneless; avoid Zone-specific patterns.
- Frontend is mobile-first and avoids DevExtreme (native controls).
- PDF viewing uses PDF.js range streaming; backend exposes Accept-Ranges/Content-Range via CORS.
- Use npm run dev:win on Windows (API :3001, Web :4300).


