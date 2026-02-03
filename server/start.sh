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

# Update any 'Free' enum values to 'Start' directly via SQL
# This is needed because Prisma Client expects only Start/Pro/Business
# Note: 'Start' should already exist in the enum from previous migration attempts
echo "Updating any 'Free' plan values to 'Start'..."

cat > /tmp/fix_enum.sql << 'EOSQL'
-- Update all users with 'Free' plan to 'Start' (if Start exists in enum)
UPDATE "users" SET "plan" = 'Start' WHERE "plan" = 'Free';

-- Update payment_requests if table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payment_requests') THEN
    UPDATE "payment_requests" SET "plan" = 'Start' WHERE "plan" = 'Free';
  END IF;
END $$;
EOSQL

# Execute the fix SQL using Prisma db execute
echo "Executing SQL fix..."
if npx prisma db execute --file /tmp/fix_enum.sql 2>&1; then
  echo "SQL fix completed successfully"
else
  echo "Note: SQL fix may have failed - Start enum value might not exist yet"
  echo "Will proceed with migration which should add the enum value"
fi

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
