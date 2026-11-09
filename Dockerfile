# syntax=docker/dockerfile:1

# ──────────────────────────────────────────────────────────────
# Renne TGBot — production image (linux/amd64)
#
# The repo bundles x86-64 ffmpeg/ffprobe binaries in bin/, so the
# image is built for linux/amd64 only (matches Synology Intel/AMD NAS).
# ──────────────────────────────────────────────────────────────

# ─── Stage 1: build TypeScript ────────────────────────────────
FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ─── Stage 2: production dependencies only ────────────────────
FROM node:20-bookworm-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ─── Stage 3: runtime ─────────────────────────────────────────
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    TZ=Asia/Hong_Kong

# Production deps + compiled output + bundled ffmpeg binaries
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./
COPY bin ./bin

# media.ts resolves ffmpeg at <app>/bin/ffmpeg (projectRoot = dirname(dist/modules)/../..)
RUN chmod +x bin/ffmpeg bin/ffprobe \
 && mkdir -p /tmp/renne-bot \
 && chown -R node:node /tmp/renne-bot

USER node

# Bot reads BOT_TOKEN / TELEGRAPH_TOKEN from the environment
# (docker-compose passes them via env_file). No .env baked in.
CMD ["node", "dist/bot.js"]
