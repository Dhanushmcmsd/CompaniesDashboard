/*
  Warnings:

  - You are about to drop the column `inserted` on the `upload_batches` table. All the data in the column will be lost.
  - You are about to drop the column `updated` on the `upload_batches` table. All the data in the column will be lost.
  - You are about to drop the `gold_loan_balance` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `gold_loan_transaction` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "upload_batches" DROP COLUMN "inserted",
DROP COLUMN "updated",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pending';

-- DropTable
DROP TABLE "gold_loan_balance";

-- DropTable
DROP TABLE "gold_loan_transaction";

-- CreateTable
CREATE TABLE "gold_loan_snapshots" (
    "id" TEXT NOT NULL,
    "uploadBatchId" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3),
    "totalAUM" DOUBLE PRECISION NOT NULL,
    "totalAccounts" INTEGER NOT NULL,
    "totalCustomers" INTEGER NOT NULL,
    "avgTicketSize" DOUBLE PRECISION NOT NULL,
    "avgYield" DOUBLE PRECISION NOT NULL,
    "totalGoldWeight" DOUBLE PRECISION NOT NULL,
    "avgGoldWeightPerLoan" DOUBLE PRECISION NOT NULL,
    "avgLTV" DOUBLE PRECISION NOT NULL,
    "avgPresentRate" DOUBLE PRECISION NOT NULL,
    "avgGoldValuePerLoan" DOUBLE PRECISION NOT NULL,
    "newDisbursements" DOUBLE PRECISION NOT NULL,
    "mtdDisbursements" DOUBLE PRECISION NOT NULL,
    "ytdDisbursements" DOUBLE PRECISION NOT NULL,
    "gnpaAmount" DOUBLE PRECISION NOT NULL,
    "gnpaPct" DOUBLE PRECISION NOT NULL,
    "nnpaPct" DOUBLE PRECISION NOT NULL,
    "totalOverdue" DOUBLE PRECISION NOT NULL,
    "overdueCollection" DOUBLE PRECISION NOT NULL,
    "collectionEfficiency" DOUBLE PRECISION NOT NULL,
    "overduePercent" DOUBLE PRECISION NOT NULL,
    "bucket0to30" DOUBLE PRECISION NOT NULL,
    "bucket31to60" DOUBLE PRECISION NOT NULL,
    "bucket61to90" DOUBLE PRECISION NOT NULL,
    "bucket90plus" DOUBLE PRECISION NOT NULL,
    "branchAUM" JSONB NOT NULL,
    "productAUM" JSONB NOT NULL,
    "branchDisbursement" JSONB NOT NULL,
    "branchNPA" JSONB NOT NULL,
    "branchGoldWeight" JSONB NOT NULL,
    "highLTVAccounts" INTEGER NOT NULL,
    "goldValueMismatch" INTEGER NOT NULL,
    "auctionCases" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gold_loan_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gold_loan_snapshots_uploadBatchId_key" ON "gold_loan_snapshots"("uploadBatchId");
