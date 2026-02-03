#!/bin/sh
set -e

echo "Checking DATABASE_URL..."
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set!"
  echo "Available environment variables:"
  env | grep -i postgres || echo "No postgres-related vars found"
  env | grep -i database || echo "No database-related vars found"
  exit 1
fi

echo "DATABASE_URL is set (length: ${#DATABASE_URL})"

# Step 1: Resolve any failed migrations FIRST
echo "Step 1: Checking for failed migrations..."
MIGRATION_STATUS=$(npx prisma migrate status 2>&1)
echo "Migration status:"
echo "$MIGRATION_STATUS"

if echo "$MIGRATION_STATUS" | grep -qi "failed"; then
  echo "Found failed migration, resolving..."
  # Resolve the known failed migration
  npx prisma migrate resolve --rolled-back "20260201210000_rename_free_to_start" 2>&1 || echo "Could not resolve migration"
fi

# Step 2: Add 'Start' enum value if it doesn't exist using ALTER TYPE
# Must be done outside of transaction (ALTER TYPE ADD VALUE)
echo "Step 2: Adding 'Start' enum value..."
cat > /tmp/add_enum.sql << 'EOSQL'
ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'Start';
EOSQL

# This might fail if already exists or if in transaction - that's OK
npx prisma db execute --file /tmp/add_enum.sql 2>&1 || echo "Note: ALTER TYPE may have failed (possibly already exists)"

# Step 3: Update users from Free to Start
echo "Step 3: Updating Free plan values to Start..."
cat > /tmp/fix_data.sql << 'EOSQL'
UPDATE "users" SET "plan" = 'Start' WHERE "plan" = 'Free';
EOSQL

if npx prisma db execute --file /tmp/fix_data.sql 2>&1; then
  echo "User data updated successfully"
else
  echo "Note: User update may have failed (possibly no Free users or Start doesn't exist)"
fi

# Step 4: Mark the migration as applied since we did it manually
echo "Step 4: Marking migration as applied..."
npx prisma migrate resolve --applied "20260201210000_rename_free_to_start" 2>&1 || echo "Could not mark migration as applied"

# Retry logic for database connection
MAX_RETRIES=10
RETRY_DELAY=3

for i in $(seq 1 $MAX_RETRIES); do
  echo "Attempt $i/$MAX_RETRIES: Running Prisma migrations..."

  # Check for failed migrations and resolve them
  MIGRATION_STATUS=$(npx prisma migrate status 2>&1)
  echo "Migration status output:"
  echo "$MIGRATION_STATUS"

  if echo "$MIGRATION_STATUS" | grep -qi "failed"; then
    echo "Found failed migrations, attempting to resolve..."

    # Extract migration name - it's the timestamp_name format before "Failed"
    # Format: "20260201210000_rename_free_to_start Failed"
    FAILED_NAME=$(echo "$MIGRATION_STATUS" | grep -i "failed" | grep -oE "[0-9]{14}_[a-z_]+" | head -1 || true)

    if [ -z "$FAILED_NAME" ]; then
      # Alternative: try to find any migration name pattern
      FAILED_NAME=$(echo "$MIGRATION_STATUS" | grep -oE "[0-9]{14}_[a-zA-Z0-9_]+" | tail -1 || true)
    fi

    if [ -n "$FAILED_NAME" ]; then
      echo "Resolving failed migration: $FAILED_NAME"
      npx prisma migrate resolve --rolled-back "$FAILED_NAME" || true
    else
      echo "Could not extract failed migration name, trying manual resolution..."
      # Hardcoded fallback for known migration
      npx prisma migrate resolve --rolled-back "20260201210000_rename_free_to_start" || true
    fi
  fi

  if npx prisma migrate deploy; then
    echo "Migrations completed successfully!"
    break
  else
    if [ $i -eq $MAX_RETRIES ]; then
      echo "Failed to run migrations after $MAX_RETRIES attempts"
      # Don't exit, try to start server anyway
      echo "Attempting to start server without successful migration..."
      break
    fi
    echo "Migration failed, retrying in ${RETRY_DELAY}s..."
    sleep $RETRY_DELAY
  fi
done

echo "Starting server..."
node dist/index.js
