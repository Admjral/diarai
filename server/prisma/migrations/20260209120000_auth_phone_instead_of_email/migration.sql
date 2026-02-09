-- Add phone column to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" TEXT;

-- Migrate existing users: use email as phone placeholder for existing users
UPDATE "users" SET "phone" = "email" WHERE "phone" IS NULL;

-- Make phone NOT NULL and UNIQUE
ALTER TABLE "users" ALTER COLUMN "phone" SET NOT NULL;

-- Drop old email unique constraint if exists
DROP INDEX IF EXISTS "users_email_key";

-- Create unique index on phone
CREATE UNIQUE INDEX IF NOT EXISTS "users_phone_key" ON "users"("phone");

-- Make email optional (nullable)
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
