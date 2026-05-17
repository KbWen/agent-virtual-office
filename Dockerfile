# syntax=docker/dockerfile:1

# ─── Stage 1: builder ──────────────────────────────────────────────
# Installs full deps and compiles the Vite bundle into dist/.
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests first so the dependency layer is cached independently
# of source changes.
COPY package*.json ./
RUN npm ci --prefer-offline --no-audit --no-fund

# Copy the rest of the source and build the static bundle.
COPY . .
RUN npm run build

# ─── Stage 2: runner ───────────────────────────────────────────────
# Minimal runtime image: only the built assets and the standalone
# zero-dependency Node server. No node_modules required at runtime.
FROM node:20-alpine AS runner

ENV NODE_ENV=production

WORKDIR /app

# server.mjs is pure ESM and uses only Node built-ins, but package.json
# is kept so tooling can resolve the package metadata / "type" field.
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.mjs ./server.mjs
COPY --from=builder /app/package.json ./package.json

EXPOSE 5174

CMD ["node", "server.mjs", "--host", "--no-open"]
