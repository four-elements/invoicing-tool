#!/bin/sh
set -e

echo 'Running database migrations...'
node /app/apps/web/migrate.mjs
echo 'Migrations complete. Starting app...'
exec node /app/apps/web/server.js
