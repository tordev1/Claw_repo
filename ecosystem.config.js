/**
 * pm2 Ecosystem Config — Project Claw
 * Usage:
 *   pm2 start ecosystem.config.js   # start all
 *   pm2 stop all                    # stop all
 *   pm2 restart all                 # restart all
 *   pm2 logs                        # tail all logs
 *   pm2 save && pm2 startup         # auto-start on boot
 */

module.exports = {
  apps: [
    {
      name: 'claw-api',
      script: 'src/server.js',
      cwd: './api-server',
      watch: false,
      autorestart: true,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOST: '0.0.0.0',
      },
    },
    {
      name: 'claw-web',
      script: 'npm',
      args: 'run dev',
      cwd: './web-hq',
      watch: false,
      autorestart: true,
    },
    {
      name: 'claw-notifier',
      script: 'scripts/notifier.js',
      watch: false,
      autorestart: true,
      max_memory_restart: '100M',
    },
    {
      name: 'claw-agent-kotlet-pm',
      script: 'agentCLI.js',
      cwd: './api-server',
      args: '--name "Kotlet PM" --handle kotlet_pm --type pm',
      watch: false,
      autorestart: true,
    },
    {
      name: 'claw-agent-kotlet-ops',
      script: 'agentCLI.js',
      cwd: './api-server',
      args: '--name "Kotlet Ops Tester" --handle kotlet_ops --type worker',
      watch: false,
      autorestart: true,
    },
    {
      name: 'claw-agent-testagent',
      script: 'agentCLI.js',
      cwd: './api-server',
      args: '--name "TestAgent" --handle testagent --type worker',
      watch: false,
      autorestart: true,
    },
  ],
};
