-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PENDING', 'EMPLOYEE', 'MANAGEMENT', 'ADMIN');

-- CreateTable
CREATE TABLE "gold_loan_balance" (
    "id" TEXT NOT NULL,
    "loanAccountNumber" TEXT NOT NULL,
    "customerId" TEXT,
    "branchName" TEXT,
    "branchState" TEXT,
    "branchRegion" TEXT,
    "schemeName" TEXT,
    "disbursementDate" TIMESTAMP(3),
    "maturityDate" TIMESTAMP(3),
    "closureDate" TIMESTAMP(3),
    "closureReason" TEXT,
    "closingBalance" DOUBLE PRECISION,
    "totalOutstanding" DOUBLE PRECISION,
    "goldWeight" DOUBLE PRECISION,
    "goldPurity" DOUBLE PRECISION,
    "interestRate" DOUBLE PRECISION,
    "presentRate" DOUBLE PRECISION,
    "dpd" INTEGER,
    "principalCr" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gold_loan_balance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gold_loan_transaction" (
    "id" TEXT NOT NULL,
    "loanAccountNumber" TEXT NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "principalReceived" DOUBLE PRECISION,
    "interestReceived" DOUBLE PRECISION,
    "otherCharges" DOUBLE PRECISION,
    "totalAmountReceived" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gold_loan_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PENDING',
    "company" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "company" TEXT NOT NULL,
    "note" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,

    CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gold_loan_balance_loanAccountNumber_key" ON "gold_loan_balance"("loanAccountNumber");

-- CreateIndex
CREATE INDEX "gold_loan_transaction_loanAccountNumber_idx" ON "gold_loan_transaction"("loanAccountNumber");

-- CreateIndex
CREATE INDEX "gold_loan_transaction_transactionDate_idx" ON "gold_loan_transaction"("transactionDate");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
