#!/usr/bin/env node

/**
 * Self-updater for Renne Bot
 *
 * Runs as a pm2 process. Every 60 seconds:
 * 1. Fetches latest _pm2_prod_run from origin
 * 2. Compares local vs remote HEAD
 * 3. If different → git pull → npm ci → pm2 restart renne-tgbot
 * 4. Logs everything
 */

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const POLL_INTERVAL = 60_000; // 1 minute
const BOT_APP_NAME = "renne-tgbot";
const REPO_DIR = path.resolve(__dirname, "..");

let lastKnownCommit = null;

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

function exec(cmd, opts = {}) {
  return execSync(cmd, {
    cwd: REPO_DIR,
    encoding: "utf-8",
    timeout: 30_000,
    stdio: ["pipe", "pipe", "pipe"],
    ...opts,
  }).trim();
}

function getLocalCommit() {
  try {
    return exec("git rev-parse HEAD");
  } catch {
    return null;
  }
}

function getRemoteCommit() {
  try {
    exec("git fetch origin _pm2_prod_run --quiet");
    return exec("git rev-parse origin/_pm2_prod_run");
  } catch {
    return null;
  }
}

function pullLatest() {
  log("Pulling latest changes...");
  exec("git pull origin _pm2_prod_run --quiet");
  log("Pull complete");
}

function installDeps() {
  log("Installing dependencies...");
  exec("npm ci --omit=dev --quiet", { timeout: 120_000 });
  log("Dependencies installed");
}

function restartBot() {
  log(`Restarting ${BOT_APP_NAME}...`);
  try {
    execSync(`pm2 restart ${BOT_APP_NAME}`, {
      cwd: REPO_DIR,
      stdio: "pipe",
    });
    log("Bot restarted successfully");
  } catch (err) {
    log(`Failed to restart bot: ${err.message}`);
  }
}

function createLogsDir() {
  const logsDir = path.join(REPO_DIR, "logs");
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
}

function poll() {
  const local = getLocalCommit();
  const remote = getRemoteCommit();

  if (!local || !remote) {
    log("Could not determine commit hashes, skipping this cycle");
    return;
  }

  if (local === remote) {
    log("Up to date (HEAD matches origin/_pm2_prod_run)");
    return;
  }

  log(`Update detected!`);
  log(`  local:  ${local.substring(0, 8)}`);
  log(`  remote: ${remote.substring(0, 8)}`);

  try {
    pullLatest();
    installDeps();
    restartBot();
    lastKnownCommit = getLocalCommit();
    log(`Updated to ${lastKnownCommit?.substring(0, 8)}`);
  } catch (err) {
    log(`Update failed: ${err.message}`);
    log("Will retry next cycle");
  }
}

// ── Main ─────────────────────────────────────────────────────

createLogsDir();
log(`Update checker started (polling every ${POLL_INTERVAL / 1000}s)`);
log(`Repo: ${REPO_DIR}`);
log(`Last known commit: ${getLocalCommit()?.substring(0, 8) || "unknown"}`);

// Initial check
poll();

// Recurring check
setInterval(poll, POLL_INTERVAL);
