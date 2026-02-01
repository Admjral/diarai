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
  FAILED_MIGRATIONS=$(npx prisma migrate status 2>&1 | grep -o "failed" || true)
  if [ -n "$FAILED_MIGRATIONS" ]; then
    echo "Found failed migrations, attempting to resolve..."
    # Get the name of the failed migration
    FAILED_NAME=$(npx prisma migrate status 2>&1 | grep "failed" | head -1 | awk '{print $1}' || true)
    if [ -n "$FAILED_NAME" ]; then
      echo "Resolving failed migration: $FAILED_NAME"
      npx prisma migrate resolve --rolled-back "$FAILED_NAME" || true
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
