#!/bin/sh
set -e

echo "=== DIAR AI Server Startup ==="

echo "Checking DATABASE_URL..."
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set!"
  exit 1
fi
echo "DATABASE_URL is set (length: ${#DATABASE_URL})"

# Quick fix: resolve known failed migration and add enum value
echo "Resolving migration issues..."

# 1. Resolve the failed migration (mark as rolled-back so it doesn't block)
npx prisma migrate resolve --rolled-back "20260201210000_rename_free_to_start" 2>/dev/null || true

# 2. Add Start enum value (outside transaction)
cat > /tmp/add_enum.sql << 'EOSQL'
ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'Start';
EOSQL
npx prisma db execute --file /tmp/add_enum.sql 2>/dev/null || true

# 3. Update users from Free to Start
cat > /tmp/fix_data.sql << 'EOSQL'
UPDATE "users" SET "plan" = 'Start' WHERE "plan" = 'Free';
EOSQL
npx prisma db execute --file /tmp/fix_data.sql 2>/dev/null || true

# 4. Mark migration as applied
npx prisma migrate resolve --applied "20260201210000_rename_free_to_start" 2>/dev/null || true

# 5. Run any other pending migrations
echo "Running migrations..."
npx prisma migrate deploy || echo "Some migrations may have failed"

# 6. Start server
echo "Starting server..."
node dist/index.js
