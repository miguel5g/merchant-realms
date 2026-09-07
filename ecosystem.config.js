module.exports = {
  apps: [
    {
      name: 'merchant-realms',
      script: './server.js',
      // Servidor autoritativo com estado em memória e WebSocket: executa em modo fork (1 instância)
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      ignore_watch: [
        'node_modules',
        'logs',
        'world.json',
        'players.json',
        '.git'
      ],
      max_memory_restart: '500M',
      // Arquivos de log
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Variáveis de ambiente padrão
      env: {
        NODE_ENV: 'development',
        PORT: 3100,
        SERVER_NAME: 'Vale do Norte',
        SEED: 1029,
        MAX_PLAYERS: 20
      },

      // Ambiente de produção: pm2 start ecosystem.config.js --env production
      env_production: {
        NODE_ENV: 'production',
        PORT: 3100,
        SERVER_NAME: 'Vale do Norte',
        SEED: 1029,
        MAX_PLAYERS: 20
      }
    }
  ]
};
