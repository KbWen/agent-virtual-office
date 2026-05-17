// PM2 ecosystem config for agent-virtual-office.
// CJS format because package.json declares "type": "commonjs".
//
// Usage (run from this directory, or pass the full path):
//   pm2 start pm2.config.cjs      # start the app
//   pm2 save                      # persist the process list
//   pm2 startup                   # generate a boot script (run the printed command)
//   pm2 logs agent-virtual-office # tail logs
//   pm2 restart agent-virtual-office
//
// Build the project first: `npm run build` (server.mjs serves dist/).

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
      // --host exposes 0.0.0.0; --no-open skips the browser launch on a server.
      args: '--host --no-open',
      cwd: projectRoot,
      // server.mjs reads local status files — never run more than one instance.
      instances: 1,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
}
