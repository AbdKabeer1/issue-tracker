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
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
COPY --from=builder /app ./
EXPOSE 3000

# Traefik routing labels for Coolify
LABEL "traefik.enable"="true"
LABEL "traefik.http.routers.bug-tracker.rule"="Host(`contributors.zedu.chat`) && PathPrefix(`/bug-tracker`)"
LABEL "traefik.http.routers.bug-tracker.priority"="1000"
LABEL "traefik.http.services.bug-tracker.loadbalancer.server.port"="3000"

# Apply pending Prisma migrations, then start the server
CMD ["sh", "-c", "node scripts/migrate.mjs; pnpm run start"]
