-- Migration: add_overdue_account_numbers
-- Adds overdueAccountNumbers (JSON array of loan account number strings)
-- to gold_loan_snapshots for transaction statement cross-referencing.
-- Field is nullable so existing snapshots (balance-sheet only) remain valid.

ALTER TABLE "gold_loan_snapshots" ADD COLUMN "overdueAccountNumbers" JSONB;
