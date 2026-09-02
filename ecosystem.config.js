// Minimal PM2 config for 4 core 6GB/4GB SHARED box (other app on same host)
// Targets: ZeptoMail 500 max -> we batch 250 for headroom, low latency
// Email:250  SMS:100  Push:250  - see .scratch/plan-minimal-250.md
module.exports = {
  apps: [
    {
      name: "sanarwa-api",
      cwd: "./apps/api",
      script: "dist/main.js",
      instances: 1, // 1 API on shared box - keeps ~700MB, leaves RAM for other app + Postgres/Redis
      exec_mode: "cluster",
      max_memory_restart: "700M",
      node_args: "--max-old-space-size=650",
      env: {
        NODE_ENV: "production",
        PORT: 9000,
        // Minimal batch tuning for 250 burst
        BATCH_MAX_SIZE: "250",
        BATCH_MAX_CONCURRENCY: "5",
        PROVIDER_BULK_BATCH_SIZE: "250",
        HTTP_POOL_MAX_SOCKETS: "20",
        HTTP_POOL_MAX_FREE_SOCKETS: "5",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 9000,
        BATCH_MAX_SIZE: "250",
        BATCH_MAX_CONCURRENCY: "5",
        PROVIDER_BULK_BATCH_SIZE: "250",
        HTTP_POOL_MAX_SOCKETS: "20",
        HTTP_POOL_MAX_FREE_SOCKETS: "5",
      },
      min_uptime: "10s",
      max_restarts: 10,
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      watch: false,
      error_file: "./logs/pm2-api-error.log",
      out_file: "./logs/pm2-api-out.log",
      merge_logs: true,
      time: true,
    },
    {
      name: "sanarwa-worker",
      cwd: "./apps/api",
      script: "dist/main.js",
      instances: 1, // 1 worker on shared box - total 2 processes ~1.4GB
      exec_mode: "cluster",
      max_memory_restart: "700M",
      node_args: "--max-old-space-size=650",
      env: {
        NODE_ENV: "production",
        PORT: 9001,
        IS_WORKER: "true",
        BATCH_MAX_SIZE: "250",
        BATCH_MAX_CONCURRENCY: "5",
        PROVIDER_BULK_BATCH_SIZE: "250",
        HTTP_POOL_MAX_SOCKETS: "20",
        HTTP_POOL_MAX_FREE_SOCKETS: "5",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 9001,
        IS_WORKER: "true",
        BATCH_MAX_SIZE: "250",
        BATCH_MAX_CONCURRENCY: "5",
        PROVIDER_BULK_BATCH_SIZE: "250",
        HTTP_POOL_MAX_SOCKETS: "20",
        HTTP_POOL_MAX_FREE_SOCKETS: "5",
      },
      min_uptime: "10s",
      max_restarts: 10,
      kill_timeout: 10000,
      wait_ready: true,
      listen_timeout: 10000,
      watch: false,
      error_file: "./logs/pm2-worker-error.log",
      out_file: "./logs/pm2-worker-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};

// To scale on 6GB box when other app idle: pm2 scale sanarwa-api 2  (2+1 = 3 processes ~2.1GB)
// To rollback to single process: pm2 delete all && pnpm --filter @sanarwa/api start:prod
