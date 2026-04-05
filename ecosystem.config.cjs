module.exports = {
  apps: [
    {
      name: "pregadores-web",
      cwd: "/var/www/pregadores",
      script: "npm",
      args: "run start:prod",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        HOSTNAME: "127.0.0.1",
        NODE_OPTIONS: "--dns-result-order=ipv4first"
      }
    }
  ]
};
