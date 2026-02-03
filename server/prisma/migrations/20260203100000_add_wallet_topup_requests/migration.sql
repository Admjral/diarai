-- CreateEnum
CREATE TYPE "WalletTopUpStatus" AS ENUM ('pending_payment', 'paid', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "wallet_topup_requests" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "WalletTopUpStatus" NOT NULL DEFAULT 'pending_payment',
    "note" TEXT,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "processedBy" INTEGER,

    CONSTRAINT "wallet_topup_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wallet_topup_requests_userId_idx" ON "wallet_topup_requests"("userId");

-- CreateIndex
CREATE INDEX "wallet_topup_requests_status_idx" ON "wallet_topup_requests"("status");

-- CreateIndex
CREATE INDEX "wallet_topup_requests_createdAt_idx" ON "wallet_topup_requests"("createdAt");

-- AddForeignKey
ALTER TABLE "wallet_topup_requests" ADD CONSTRAINT "wallet_topup_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
