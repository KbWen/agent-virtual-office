# syntax=docker/dockerfile:1

# ─── Stage 1: builder ──────────────────────────────────────────────
# Installs full deps and compiles the Vite bundle into dist/.
FROM node:22-alpine AS builder

WORKDIR /app

# Copy manifests first so the dependency layer is cached independently
# of source changes.
COPY package*.json ./
RUN npm ci --prefer-offline --no-audit --no-fund

# Copy only what the Vite build needs so unrelated file changes don't
# bust this layer.
COPY src ./src
COPY public ./public
COPY index.html .
COPY vite.config.js .
RUN npm run build

# server.mjs is copied last (it is not a Vite input) so the runner
# stage can pull it from /app without an extra build context.
COPY server.mjs .

# ─── Stage 2: runner ───────────────────────────────────────────────
# Minimal runtime image: only the built assets and the standalone
# zero-dependency Node server. No node_modules required at runtime.
FROM node:22-alpine AS runner

ENV NODE_ENV=production

WORKDIR /app

# server.mjs uses only Node built-ins for I/O, but it is NOT self-contained: it
# imports src/server/scanSessions.mjs and src/utils/normalizePost.mjs (which in turn
# imports src/utils/statusContract.mjs). Those two directories are the ENTIRE runtime
# import closure -- omitting them made the container exit on startup with
# ERR_MODULE_NOT_FOUND. tests/dockerRuntimeClosure.test.js walks server.mjs's import
# graph and fails if anything resolves outside the directories copied here, so a future
# import cannot silently re-break the image. package.json is kept so tooling can resolve
# the package metadata / "type" field.
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/server.mjs ./server.mjs
COPY --chown=node:node --from=builder /app/package.json ./package.json
COPY --chown=node:node --from=builder /app/src/server ./src/server
COPY --chown=node:node --from=builder /app/src/utils ./src/utils

# Drop root for the runtime process.
USER node

EXPOSE 5174

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5174/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# --host binds 0.0.0.0 inside the container so Docker's port forwarding
# can reach the server. External access is still restricted to 127.0.0.1
# by the "127.0.0.1:5174:5174" port mapping in docker-compose.yml.
# (Native PM2/systemd deployments behind Nginx do NOT use --host.)
CMD ["node", "server.mjs", "--host", "--no-open"]
