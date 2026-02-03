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
