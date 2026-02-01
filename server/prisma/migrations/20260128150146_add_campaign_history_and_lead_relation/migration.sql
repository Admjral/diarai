-- CreateEnum
CREATE TYPE "CampaignAction" AS ENUM ('created', 'updated', 'approved', 'rejected', 'paused', 'activated');

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "rejectionReason" TEXT;

-- AlterTable
ALTER TABLE "messenger_conversations" ADD COLUMN     "leadId" INTEGER;

-- CreateTable
CREATE TABLE "campaign_history" (
    "id" SERIAL NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "adminId" INTEGER NOT NULL,
    "action" "CampaignAction" NOT NULL,
    "fieldName" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaign_history_campaignId_idx" ON "campaign_history"("campaignId");

-- CreateIndex
CREATE INDEX "campaign_history_adminId_idx" ON "campaign_history"("adminId");

-- CreateIndex
CREATE INDEX "messenger_conversations_leadId_idx" ON "messenger_conversations"("leadId");

-- AddForeignKey
ALTER TABLE "campaign_history" ADD CONSTRAINT "campaign_history_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_history" ADD CONSTRAINT "campaign_history_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messenger_conversations" ADD CONSTRAINT "messenger_conversations_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
