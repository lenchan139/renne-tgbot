#!/bin/bash
# ──────────────────────────────────────────────────────────────
# Renne Bot — Production Bootstrap Script
#
# Run this ONCE on the server after cloning _pm2_prod_run:
#   git clone -b _pm2_prod_run <repo-url> /opt/renne-bot
#   cd /opt/renne-bot
#   bash scripts/prod-start.sh
#
# This installs pm2 (if missing), sets up logs, and starts both
# the bot and the self-updater process.
# ──────────────────────────────────────────────────────────────

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "═══════════════════════════════════════════"
echo "  Renne Bot — Production Setup"
echo "═══════════════════════════════════════════"

# ── Check Node.js ─────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "❌ Node.js not found. Please install Node.js >= 18"
  exit 1
fi

NODE_VERSION=$(node -v)
echo "✅ Node.js $NODE_VERSION"

# ── Check ffmpeg ──────────────────────────────────────────────
if ! command -v ffmpeg &>/dev/null; then
  echo "⚠️  ffmpeg not found. Video/GIF conversion will fail."
  echo "   Install with: sudo apt install ffmpeg"
fi

# ── Install pm2 globally if missing ───────────────────────────
if ! command -v pm2 &>/dev/null; then
  echo "📦 Installing pm2..."
  npm install -g pm2
  echo "✅ pm2 installed"
else
  echo "✅ pm2 already installed"
fi

# ── Create logs directory ─────────────────────────────────────
mkdir -p logs

# ── Check .env ────────────────────────────────────────────────
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo "⚠️  .env not found. Copying from .env.example"
    echo "   Edit .env and set BOT_TOKEN before starting!"
    cp .env.example .env
  else
    echo "❌ No .env or .env.example found"
    exit 1
  fi
fi

# ── Install production dependencies ───────────────────────────
if [ ! -d node_modules ]; then
  echo "📦 Installing dependencies..."
  npm ci --omit=dev
fi

# ── Stop existing processes ───────────────────────────────────
echo "🔄 Stopping existing processes..."
pm2 delete renne-tgbot 2>/dev/null || true
pm2 delete renne-updater 2>/dev/null || true

# ── Start processes ───────────────────────────────────────────
echo "🚀 Starting Renne Bot..."
pm2 start ecosystem/ecosystem.config.js

# ── Save pm2 process list & setup startup ─────────────────────
pm2 save

# Setup pm2 to start on system boot
pm2 startup 2>/dev/null || {
  echo ""
  echo "⚠️  To auto-start on boot, run the command pm2 printed above"
  echo ""
}

# ── Done ──────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ Renne Bot is running!"
echo "═══════════════════════════════════════════"
echo ""
echo "  pm2 status          — check process status"
echo "  pm2 logs            — view live logs"
echo "  pm2 restart all     — restart everything"
echo "  pm2 stop all        — stop everything"
echo ""
echo "  The updater checks for new commits every 60s."
echo "  It will auto-pull and restart the bot on changes."
echo ""
