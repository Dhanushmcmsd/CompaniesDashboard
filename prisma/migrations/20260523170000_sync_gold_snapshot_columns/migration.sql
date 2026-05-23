-- Sync gold_loan_snapshots with Prisma schema (missing KPI columns)
ALTER TABLE "gold_loan_snapshots" ADD COLUMN IF NOT EXISTS "avgRatePerGram" DOUBLE PRECISION;
ALTER TABLE "gold_loan_snapshots" ADD COLUMN IF NOT EXISTS "highRiskAmount" DOUBLE PRECISION;
ALTER TABLE "gold_loan_snapshots" ADD COLUMN IF NOT EXISTS "highRiskCount" INTEGER;
ALTER TABLE "gold_loan_snapshots" ADD COLUMN IF NOT EXISTS "newCustomerFromLoanBalance" INTEGER;
ALTER TABLE "gold_loan_snapshots" ADD COLUMN IF NOT EXISTS "newCustomerFromTxn" INTEGER;
ALTER TABLE "gold_loan_snapshots" ADD COLUMN IF NOT EXISTS "sma0Amount" DOUBLE PRECISION;
ALTER TABLE "gold_loan_snapshots" ADD COLUMN IF NOT EXISTS "sma1Amount" DOUBLE PRECISION;
ALTER TABLE "gold_loan_snapshots" ADD COLUMN IF NOT EXISTS "sma2Amount" DOUBLE PRECISION;
ALTER TABLE "gold_loan_snapshots" ADD COLUMN IF NOT EXISTS "sma0Count" INTEGER;
ALTER TABLE "gold_loan_snapshots" ADD COLUMN IF NOT EXISTS "sma1Count" INTEGER;
ALTER TABLE "gold_loan_snapshots" ADD COLUMN IF NOT EXISTS "sma2Count" INTEGER;

-- Allow null when no balance sheet exists yet (transaction-only upload)
ALTER TABLE "gold_loan_snapshots" ALTER COLUMN "collectionEfficiency" DROP NOT NULL;

-- Parse metadata for employee/admin upload logs
ALTER TABLE "upload_batches" ADD COLUMN IF NOT EXISTS "parseMeta" JSONB;
