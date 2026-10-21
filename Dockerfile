FROM node:22-alpine AS deps
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# `output: "standalone"` (next.config.ts) emits the server plus only traced deps.
RUN pnpm run build

FROM node:22-alpine AS runner
# openssl + libc6-compat for Prisma, tzdata for TZ, wget for the healthcheck.
RUN apk add --no-cache openssl libc6-compat tzdata wget
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME="0.0.0.0" TZ=Africa/Lagos \
    REPORT_FORM_URL="https://docs.google.com/forms/d/e/1FAIpQLSdZh-SYglC0uFMhBPQIcZ6zAzeXm8uRiopZhBzMnZK4Cd2Kbg/viewform?usp=header"

# The standalone server, its traced node_modules and the assets Next serves
# itself. No devDependencies, tests, e2e or docs reach this stage (#585).
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

# Migrations: schema + migrations and the migrate script. The Prisma CLI is not
# part of the traced standalone output, so copy just that package and its engines.
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/scripts ./scripts
COPY --from=builder --chown=node:node /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=node:node /app/node_modules/@prisma/engines ./node_modules/@prisma/engines
RUN mkdir -p ./node_modules/.bin \
    && ln -s ../prisma/build/index.js ./node_modules/.bin/prisma

EXPOSE 3000

# Traefik routing labels for Coolify
LABEL "traefik.enable"="true"
LABEL "traefik.http.routers.ziki.rule"="Host(`ziki.dev`) || Host(`www.ziki.dev`) || Host(`issues.zedu.chat`) || (Host(`contributors.zedu.chat`) && PathPrefix(`/bug-tracker`))"
LABEL "traefik.http.routers.ziki.priority"="1000"
LABEL "traefik.http.services.ziki.loadbalancer.server.port"="3000"

# Verify database is reachable and server responds with HTTP 200 before container is declared healthy.
# Coolify rolling deployments will wait for this check and keep the existing container running if it fails.
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

# The app never runs as root: the node user owns /app (copied with --chown).
USER node

# Apply pending Prisma migrations, then start the server - only if they applied
# (#580). A failed migration exits non-zero, this container never becomes
# healthy, and Coolify keeps the previous one serving.
CMD ["sh", "-c", "node scripts/migrate.mjs && node server.js"]
