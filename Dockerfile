# ============================================================
# Stage 1: Abhängigkeiten installieren
# ============================================================
FROM node:20-alpine AS deps
WORKDIR /app

# Workspace-Manifeste zuerst kopieren (Layer-Caching)
COPY package.json package-lock.json ./
COPY packages/db/package.json ./packages/db/
COPY packages/types/package.json ./packages/types/
COPY apps/web/package.json ./apps/web/

RUN npm ci --legacy-peer-deps

# ============================================================
# Stage 2: Build
# ============================================================
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
# Dummy-Env-Vars damit next build nicht wegen fehlender Vars abbricht.
# Echte Werte werden zur Laufzeit via Coolify-Env gesetzt.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
ENV BETTER_AUTH_SECRET="placeholder-secret-min-32-chars-build-only!!"
ENV BETTER_AUTH_URL="http://localhost:3000"
ENV RESEND_API_KEY="re_placeholder"
ENV RESEND_FROM_EMAIL="noreply@placeholder.de"
ENV NEXT_PUBLIC_APP_URL="http://localhost:3000"
ENV APP_ENV="production"
ENV LOG_LEVEL="info"
ENV ADMIN_CONSENT_MAX_DAYS="30"

RUN npm run build --workspace=apps/web

# ============================================================
# Stage 3: Produktions-Image (nur standalone-Output)
# ============================================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Next.js standalone kopiert alle benötigten node_modules selbst
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static     ./apps/web/.next/static

# public-Verzeichnis nur kopieren wenn vorhanden (optional)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public           ./apps/web/public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
