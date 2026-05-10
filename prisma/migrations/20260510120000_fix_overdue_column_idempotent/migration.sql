-- Migration: fix_overdue_column_idempotent
-- Safe, idempotent version of add_overdue_account_numbers.
-- Uses IF NOT EXISTS so it succeeds whether or not the column already exists.
-- Run: npx prisma migrate deploy

ALTER TABLE "gold_loan_snapshots"
  ADD COLUMN IF NOT EXISTS "overdueAccountNumbers" JSONB;
