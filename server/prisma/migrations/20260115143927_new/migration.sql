-- CreateEnum
CREATE TYPE "MessengerType" AS ENUM ('whatsapp', 'telegram', 'instagram');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('active', 'archived', 'closed');

-- CreateEnum
CREATE TYPE "MessageSenderType" AS ENUM ('customer', 'operator', 'ai');

-- CreateEnum
CREATE TYPE "MessageDeliveryStatus" AS ENUM ('received', 'pending', 'sent', 'delivered', 'read', 'failed');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'messenger_new_message';
ALTER TYPE "NotificationType" ADD VALUE 'messenger_escalation';

-- CreateTable
CREATE TABLE "messenger_configs" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" "MessengerType" NOT NULL,
    "credentials" JSONB NOT NULL DEFAULT '{}',
    "webhookSecret" TEXT,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "aiSystemPrompt" TEXT,
    "aiModel" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "aiTemperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "escalationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "escalationKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" TIMESTAMP(3),
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messenger_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messenger_conversations" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "messengerId" TEXT NOT NULL,
    "messengerType" "MessengerType" NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT,
    "contactAvatar" TEXT,
    "lastMessage" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "status" "ConversationStatus" NOT NULL DEFAULT 'active',
    "assignedToId" INTEGER,
    "aiResponseCount" INTEGER NOT NULL DEFAULT 0,
    "escalatedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messenger_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messenger_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sender" "MessageSenderType" NOT NULL,
    "senderName" TEXT,
    "isAIGenerated" BOOLEAN NOT NULL DEFAULT false,
    "aiConfidence" DOUBLE PRECISION,
    "aiIntent" TEXT,
    "status" "MessageDeliveryStatus" NOT NULL DEFAULT 'received',
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "isEscalated" BOOLEAN NOT NULL DEFAULT false,
    "escalatedAt" TIMESTAMP(3),
    "escalationNote" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messenger_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "messenger_configs_userId_idx" ON "messenger_configs"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "messenger_configs_userId_type_key" ON "messenger_configs"("userId", "type");

-- CreateIndex
CREATE INDEX "messenger_conversations_userId_idx" ON "messenger_conversations"("userId");

-- CreateIndex
CREATE INDEX "messenger_conversations_status_idx" ON "messenger_conversations"("status");

-- CreateIndex
CREATE INDEX "messenger_conversations_lastMessageAt_idx" ON "messenger_conversations"("lastMessageAt");

-- CreateIndex
CREATE INDEX "messenger_conversations_assignedToId_idx" ON "messenger_conversations"("assignedToId");

-- CreateIndex
CREATE UNIQUE INDEX "messenger_conversations_userId_messengerId_messengerType_key" ON "messenger_conversations"("userId", "messengerId", "messengerType");

-- CreateIndex
CREATE INDEX "messenger_messages_conversationId_idx" ON "messenger_messages"("conversationId");

-- CreateIndex
CREATE INDEX "messenger_messages_createdAt_idx" ON "messenger_messages"("createdAt");

-- CreateIndex
CREATE INDEX "messenger_messages_isEscalated_idx" ON "messenger_messages"("isEscalated");

-- AddForeignKey
ALTER TABLE "messenger_messages" ADD CONSTRAINT "messenger_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "messenger_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
