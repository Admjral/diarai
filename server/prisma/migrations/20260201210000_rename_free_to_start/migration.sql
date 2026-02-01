-- Rename Plan enum value from 'Free' to 'Start'
-- PostgreSQL requires ALTER TYPE to rename enum values

-- Step 1: Add new value 'Start' to the enum
ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'Start';

-- Step 2: Update all users with 'Free' plan to 'Start'
UPDATE "users" SET "plan" = 'Start' WHERE "plan" = 'Free';

-- Step 3: Update payment_requests if any reference Free
UPDATE "payment_requests" SET "plan" = 'Start' WHERE "plan" = 'Free';

-- Note: PostgreSQL doesn't allow dropping enum values easily
-- The 'Free' value will remain in the enum but won't be used
-- This is safe and won't cause issues
