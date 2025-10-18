Laptop (Windows) Quick Deploy

Prerequisites
- Node.js 20 (winget: winget install OpenJS.NodeJS.LTS)
- Git

Dev Run (API :3001, Web :4300)
1) PowerShell: copy app\backend\.env.example app\backend\.env
2) Run: scripts\local-dev.ps1

Production-like (single port)
1) npm run build
2) PowerShell:
   set SERVE_FRONTEND=1
   node app\backend\dist\main.js
3) Open http://localhost:3000

Auth & Users
- Default admin: admin@example.com / ChangeThis123!
- Reader user created: galiferous@example.com / start123

Environment Tips
- For cookie-only auth in production: set AUTH_COOKIE_ONLY=1 and NODE_ENV=production in app\backend\.env
- For dev CORS: CORS_ORIGIN includes http://localhost:4200 and http://localhost:4300 by default

Troubleshooting
- If sharp/better-sqlite3 fail to build, consider installing VS Build Tools 2022 or use WSL
- PDF covers require pdftoppm (poppler) but PDF reading works without it

