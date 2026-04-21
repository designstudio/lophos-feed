#!/bin/sh
set -e

mkdir -p /app/logs

# BusyBox crond reads jobs from /etc/crontabs/root in Alpine.
/usr/sbin/crond

exec su-exec nextjs npm run start
