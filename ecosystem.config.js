module.exports = {
  apps: [
    {
      name: "index",
      cwd: "/home/ubuntu/indexx-exchange-backend",
      script: "dist/index.js",

      exec_mode: "cluster",   // must be cluster
      instances: 8,           // one cluster with 8 workers

      env: {
        NODE_ENV: "production",
        NODE_CLUSTER_SCHED_POLICY: "rr"
      },

      max_memory_restart: "3G",
      listen_timeout: 8000,
      kill_timeout: 5000,
      autorestart: true,
      min_uptime: "10s",
      restart_delay: 2000,
      merge_logs: true,
      out_file: "/home/ubuntu/.pm2/logs/index-out.log",
      error_file: "/home/ubuntu/.pm2/logs/index-error.log",
      time: true
    }
  ]
};

