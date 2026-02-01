-- Rename Plan enum value from 'Free' to 'Start'
-- This migration adds 'Start' as a new enum value and updates existing data
-- The 'Free' value will remain in the enum but won't be used

-- Step 1: Add new value 'Start' to the enum using DO block (transactional safe)
DO $$
BEGIN
  -- Check if 'Start' already exists in Plan enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Start'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Plan')
  ) THEN
    -- Add 'Start' value to enum
    -- Note: We can't use ALTER TYPE ADD VALUE in a transaction
    -- So we insert directly into pg_enum
    INSERT INTO pg_enum (enumtypid, enumlabel, enumsortorder)
    SELECT
      t.oid,
      'Start',
      (SELECT MAX(enumsortorder) + 1 FROM pg_enum WHERE enumtypid = t.oid)
    FROM pg_type t
    WHERE t.typname = 'Plan';
  END IF;
END
$$;

-- Step 2: Update all users with 'Free' plan to 'Start' (only if they exist)
UPDATE "users" SET "plan" = 'Start' WHERE "plan" = 'Free';

-- Step 3: Update payment_requests if table exists and has Free values
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payment_requests') THEN
    UPDATE "payment_requests" SET "plan" = 'Start' WHERE "plan" = 'Free';
  END IF;
END
$$;
