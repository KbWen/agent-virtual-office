// PM2 ecosystem config for agent-virtual-office.
// CJS format because package.json declares "type": "commonjs".
//
// Usage (run from repo root or pass --config path):
//   pm2 start docs/deployment/pm2.config.cjs      # start
//   pm2 save                                       # persist across reboots
//   pm2 startup                                    # generate boot script (run the printed command)
//   pm2 install pm2-logrotate                      # rotate logs (run once)
//   pm2 logs agent-virtual-office                  # tail logs
//   pm2 restart agent-virtual-office               # restart after update
//
// Build the project first: npm run build  (server.mjs serves dist/).
// Running behind Nginx: omit --host (server binds 127.0.0.1 by default).

const path = require('node:path')

// Project root — this file lives in docs/deployment/, so go up two levels.
const projectRoot = path.resolve(__dirname, '..', '..')

module.exports = {
  apps: [
    {
      name: 'agent-virtual-office',
      script: 'server.mjs',
      // PM2 needs an explicit interpreter to run .mjs (ESM) files.
      interpreter: 'node',
      // --no-open: skip browser launch on a headless server.
      // No --host: binds to 127.0.0.1 (loopback) when behind Nginx.
      // Add --host only for direct LAN access without a reverse proxy.
      args: '--no-open',
      cwd: projectRoot,
      // server.mjs reads local ~/.claude/ status files — never run > 1 instance.
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      // Back off restarts up to ~15 s instead of hammering on crash loops.
      exp_backoff_restart_delay: 200,
      // Give graceful shutdown time to drain in-flight requests (matches
      // TimeoutStopSec=15 in the systemd unit and server.mjs's 10s hard cap).
      kill_timeout: 15000,
      // Logging.
      error_file: path.join(projectRoot, 'logs', 'office-error.log'),
      out_file:   path.join(projectRoot, 'logs', 'office-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
}
