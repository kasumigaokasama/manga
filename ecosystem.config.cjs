// PM2 Ecosystem Configuration
// Usage: pm2 start ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'manga-shelf-api',
    script: './app/backend/dist/main.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_file: './app/backend/.env',
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    time: true
  }]
};
