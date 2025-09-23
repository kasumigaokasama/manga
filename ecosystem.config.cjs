// PM2 ecosystem file for API (and optionally static web server)
module.exports = {
  apps: [
    {
      name: 'manga-shelf-api',
      cwd: 'app/backend',
      script: 'node',
      args: 'dist/main.js',
      env: {
        PORT: 3000,
        NODE_ENV: 'production'
      }
    },
    {
      // Optional: serve built Angular dist via `serve -s`
      name: 'manga-shelf-web',
      cwd: '.',
      script: 'npx',
      args: 'serve -s app/frontend/dist -l 4173',
      env: {
        NODE_ENV: 'production'
      },
      autorestart: false,
      watch: false
    }
  ]
}

