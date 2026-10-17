FROM node:20-alpine AS deps
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

FROM node:20-alpine AS builder
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl libc6-compat tzdata wget
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 TZ=Africa/Lagos
COPY --from=builder /app ./
EXPOSE 3000

# Traefik routing labels for Coolify
LABEL "traefik.enable"="true"
LABEL "traefik.http.routers.bug-tracker.rule"="Host(`issues.zedu.chat`) || (Host(`contributors.zedu.chat`) && PathPrefix(`/bug-tracker`))"
LABEL "traefik.http.routers.bug-tracker.priority"="1000"
LABEL "traefik.http.services.bug-tracker.loadbalancer.server.port"="3000"
LABEL "traefik.http.services.bug-tracker.loadbalancer.healthcheck.path"="/api/health"
LABEL "traefik.http.services.bug-tracker.loadbalancer.healthcheck.interval"="10s"
LABEL "traefik.http.services.bug-tracker.loadbalancer.healthcheck.timeout"="5s"

# Verify database is reachable and server responds with HTTP 200 before container is declared healthy.
# Coolify rolling deployments will wait for this check and keep the existing container running if it fails.
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

# Apply pending Prisma migrations; start the server only if they succeed
CMD ["sh", "-c", "node scripts/migrate.mjs && pnpm run start"]
