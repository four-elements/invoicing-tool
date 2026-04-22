#!/bin/sh
set -e
echo 'Running database migrations...'
cd /app/apps/web && npx drizzle-kit migrate --config=drizzle.config.ts
echo 'Migrations complete. Starting app...'
exec node /app/apps/web/server.js
