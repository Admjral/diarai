-- Migration: Add imageUrl to Campaign model
-- Add imageUrl column to campaigns table

ALTER TABLE "campaigns" 
ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

