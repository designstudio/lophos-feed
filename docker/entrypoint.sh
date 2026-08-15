#!/bin/sh
set -e

mkdir -p /app/logs

# Debian cron reads the preserved production schedule from /etc/cron.d.
/usr/sbin/cron -f &

STATE_FILE="/app/logs/news-cron-state.json"
STALE_AFTER_SECONDS=$((5 * 60 * 60 + 30 * 60))
NOW_SECONDS=$(date +%s)
LAST_ATTEMPT_SECONDS=0

if [ -f "$STATE_FILE" ]; then
  LAST_ATTEMPT_SECONDS=$(node -e "const fs=require('fs'); const p=process.argv[1]; try { const state=JSON.parse(fs.readFileSync(p,'utf8')); const candidates=[state.lastStartedAt,state.lastFinishedAt,state.lastSuccessAt,state.lastFailureAt].filter(Boolean); const parsed=candidates.map((value)=>Date.parse(value)).find((value)=>Number.isFinite(value)); process.stdout.write(parsed ? String(Math.floor(parsed / 1000)) : '0'); } catch { process.stdout.write('0'); }" "$STATE_FILE")
fi

if [ $((NOW_SECONDS - LAST_ATTEMPT_SECONDS)) -ge "$STALE_AFTER_SECONDS" ]; then
  echo "[entrypoint] Bootstrapping news:cron because the last pipeline attempt is stale or missing."
  (cd /app && node scripts/news-cron.mjs >> /app/logs/news-cron.log 2>&1) &
fi

exec gosu nextjs node server.js
