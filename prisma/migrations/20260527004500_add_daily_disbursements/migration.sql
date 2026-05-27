-- Store per-day transaction disbursement totals for the dashboard trend chart.
ALTER TABLE "gold_loan_snapshots" ADD COLUMN IF NOT EXISTS "dailyDisbursements" JSONB;
