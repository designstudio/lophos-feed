FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --ignore-scripts

COPY . .

RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN apk add --no-cache su-exec

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts

RUN mkdir -p /app/logs /etc/crontabs \
  && printf '%s\n' \
    '0 0,6,12,18 * * * cd /app && node scripts/news-cron.mjs >> /app/logs/news-cron.log 2>&1' \
    > /etc/crontabs/root

COPY --chown=nextjs:nodejs docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
