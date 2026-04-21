#!/bin/sh
set -e

mkdir -p /app/logs

# BusyBox crond reads jobs from /etc/crontabs/root in Alpine.
/usr/sbin/crond -f -l 8 -L /dev/stdout &

STATE_FILE="/app/logs/news-cron-state.json"
STALE_AFTER_SECONDS=$((5 * 60 * 60 + 30 * 60))
NOW_SECONDS=$(date +%s)
LAST_SUCCESS_SECONDS=0

if [ -f "$STATE_FILE" ]; then
  LAST_SUCCESS_SECONDS=$(node -e "const fs=require('fs'); const p=process.argv[1]; try { const state=JSON.parse(fs.readFileSync(p,'utf8')); const ts=Date.parse(state.lastSuccessAt || ''); process.stdout.write(Number.isFinite(ts) ? String(Math.floor(ts / 1000)) : '0'); } catch { process.stdout.write('0'); }" "$STATE_FILE")
fi

if [ $((NOW_SECONDS - LAST_SUCCESS_SECONDS)) -ge "$STALE_AFTER_SECONDS" ]; then
  echo "[entrypoint] Bootstrapping news:cron because last success is stale or missing."
  (cd /app && /usr/local/bin/npm run news:cron >> /app/logs/news-cron.log 2>&1) &
fi

exec su-exec nextjs npm run start
