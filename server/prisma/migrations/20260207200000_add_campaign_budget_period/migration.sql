-- AlterEnum: Add campaign_budget and campaign_refund to TransactionType
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'campaign_budget';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'campaign_refund';

-- AlterTable: Add budget period fields to campaigns
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "budgetPeriodDays" INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "dailyBudget" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "walletTransactionId" INTEGER;
