module.exports = {
  apps: [
    {
      name: 'mirprotocol',
      script: 'app.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      out_file: '/var/log/mir-shared/mirprotocol.log',
      error_file: '/var/log/mir-shared/mirprotocol.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
