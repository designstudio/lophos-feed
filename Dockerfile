FROM node:20-bookworm-slim AS base

# Install dependencies only when needed
FROM base AS builder
WORKDIR /app

# Keep Server Action IDs stable across self-hosted builds.
ARG NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
ENV NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$NEXT_SERVER_ACTIONS_ENCRYPTION_KEY

COPY package.json package-lock.json* ./
RUN npm install --ignore-scripts \
  && npm rebuild sharp

COPY . .

RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$NEXT_SERVER_ACTIONS_ENCRYPTION_KEY

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs --no-create-home nextjs
RUN apt-get update \
  && apt-get install -y --no-install-recommends cron gosu \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts

RUN mkdir -p /app/logs /app/.next/cache \
  && chown -R nextjs:nodejs /app \
  && printf '%s\n' \
    '0 0,6,12,18 * * * root cd /app && node scripts/news-cron.mjs >> /app/logs/news-cron.log 2>&1' \
    > /etc/cron.d/lophos-news \
  && chmod 0644 /etc/cron.d/lophos-news

COPY --chown=nextjs:nodejs docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
