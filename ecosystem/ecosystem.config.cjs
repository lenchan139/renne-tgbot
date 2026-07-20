module.exports = {
  apps: [
    {
      name: "renne-tgbot",
      script: "./dist/bot.js",
      cwd: __dirname + "/../",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      max_memory_restart: "500M",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "./logs/bot-error.log",
      out_file: "./logs/bot-out.log",
    },
    {
      name: "renne-updater",
      script: "./scripts/update-checker.cjs",
      cwd: __dirname + "/../",
      interpreter: "node",
      autorestart: true,
      max_restarts: 100,
      restart_delay: 1000,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "./logs/updater-error.log",
      out_file: "./logs/updater-out.log",
    },
  ],
};
