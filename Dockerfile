# syntax=docker/dockerfile:1.7
# -----------------------------------------------------------------------------
# ORVEX prototype: container image
#
#   docker build -t orvex-prototype .
#   docker run --rm -p 8080:8080 orvex-prototype      → http://localhost:8080
#
# Two stages: build the SPA with the full toolchain, then ship only dist/ and
# the zero-dependency server on a minimal Node.js 22 runtime as a non-root user.
# (The product's Core image, registry.orvex.io/core, is built separately.)
# -----------------------------------------------------------------------------

ARG NODE_VERSION=22

# ---- build ------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Build-time configuration (Vite inlines VITE_* variables into the bundle).
ARG VITE_API_MODE=mock
ARG VITE_INSTALLATION_API_URL=/api/admin
ARG VITE_VENDOR_API_URL=https://account.orvex.io/api
RUN npm run build

# ---- runtime ----------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runtime

LABEL org.opencontainers.image.title="orvex-prototype" \
      org.opencontainers.image.description="ORVEX Service Operations Platform: self-hosted service API orchestration (prototype, mock data only)" \
      org.opencontainers.image.vendor="ORVEX Systems"

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080

WORKDIR /app

# Only what the server needs: no node_modules, no sources.
COPY --chown=node:node package.json ./
COPY --chown=node:node server ./server
COPY --from=build --chown=node:node /app/dist ./dist

USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]

STOPSIGNAL SIGTERM
CMD ["node", "server/server.mjs"]
