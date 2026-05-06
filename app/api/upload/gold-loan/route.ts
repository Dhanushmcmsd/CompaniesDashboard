import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function normalizeHeader(h: string): string {
  return h.toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
}

function parseSheet<T>(buffer: Buffer, columnMap: Record<string, string>): T[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

  return raw.map((row) => {
    const mapped: Record<string, unknown> = {};
    for (const [rawKey, value] of Object.entries(row)) {
      const norm = normalizeHeader(rawKey);
      if (columnMap[norm]) {
        mapped[columnMap[norm]] = value;
      }
    }
    return mapped as T;
  });
}

const LOAN_BALANCE_MAP: Record<string, string> = {
  loan_account_number: 'loanAccountNumber',
  customer_id: 'customerId',
  branch_name: 'branchName',
  disbursement_date: 'disbursementDate',
  closing_balance: 'closingBalance',
  gold_weight: 'goldWeight',
  interest_rate: 'interestRate',
  dpd: 'dpd',
  principal_cr: 'principalCr',
};

const TRANSACTION_MAP: Record<string, string> = {
  loan_account_number: 'loanAccountNumber',
  transaction_date: 'transactionDate',
  principal_received: 'principalReceived',
  interest_received: 'interestReceived',
  other_charges: 'otherCharges',
  total_amount_received: 'totalAmountReceived',
};

interface LoanBalanceRow {
  loanAccountNumber?: string;
  customerId?: string;
  branchName?: string;
  disbursementDate?: Date | string | null;
  closingBalance?: number | null;
  goldWeight?: number | null;
  interestRate?: number | null;
  dpd?: number | null;
  principalCr?: number | null;
}

interface TransactionRow {
  loanAccountNumber?: string;
  transactionDate?: Date | string | null;
  principalReceived?: number | null;
  interestReceived?: number | null;
  otherCharges?: number | null;
  totalAmountReceived?: number | null;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const loanFile = formData.get('loanBalance') as File | null;
    const txnFile = formData.get('transactionStatement') as File | null;

    if (!loanFile || !txnFile) {
      return NextResponse.json({ error: 'Both files are required.' }, { status: 400 });
    }

    const loanBuffer = Buffer.from(await loanFile.arrayBuffer());
    const txnBuffer = Buffer.from(await txnFile.arrayBuffer());

    const loanRows = parseSheet<LoanBalanceRow>(loanBuffer, LOAN_BALANCE_MAP);
    const txnRows = parseSheet<TransactionRow>(txnBuffer, TRANSACTION_MAP);

    let inserted = 0;
    let updated = 0;
    const errors: string[] = [];

    // Upsert Loan Balance rows
    for (const row of loanRows) {
      if (!row.loanAccountNumber) {
        errors.push(`Loan Balance: Row missing loanAccountNumber — skipped`);
        continue;
      }
      try {
        const existing = await prisma.goldLoanBalance.findUnique({
          where: { loanAccountNumber: row.loanAccountNumber },
        });

        const payload = {
          customerId: row.customerId ?? null,
          branchName: row.branchName ?? null,
          disbursementDate: row.disbursementDate ? new Date(row.disbursementDate) : null,
          closingBalance: row.closingBalance != null ? Number(row.closingBalance) : null,
          goldWeight: row.goldWeight != null ? Number(row.goldWeight) : null,
          interestRate: row.interestRate != null ? Number(row.interestRate) : null,
          dpd: row.dpd != null ? Number(row.dpd) : null,
          principalCr: row.principalCr != null ? Number(row.principalCr) : null,
        };

        if (existing) {
          await prisma.goldLoanBalance.update({
            where: { loanAccountNumber: row.loanAccountNumber },
            data: payload,
          });
          updated++;
        } else {
          await prisma.goldLoanBalance.create({
            data: { loanAccountNumber: row.loanAccountNumber, ...payload },
          });
          inserted++;
        }
      } catch (e) {
        errors.push(`Loan Balance [${row.loanAccountNumber}]: ${(e as Error).message}`);
      }
    }

    // Upsert Transaction rows
    for (const row of txnRows) {
      if (!row.loanAccountNumber || !row.transactionDate) {
        errors.push(`Transaction: Row missing loanAccountNumber or transactionDate — skipped`);
        continue;
      }
      try {
        const txnDate = new Date(row.transactionDate);
        const existing = await prisma.goldLoanTransaction.findFirst({
          where: {
            loanAccountNumber: row.loanAccountNumber,
            transactionDate: txnDate,
          },
        });

        const payload = {
          principalReceived: row.principalReceived != null ? Number(row.principalReceived) : null,
          interestReceived: row.interestReceived != null ? Number(row.interestReceived) : null,
          otherCharges: row.otherCharges != null ? Number(row.otherCharges) : null,
          totalAmountReceived: row.totalAmountReceived != null ? Number(row.totalAmountReceived) : null,
        };

        if (existing) {
          await prisma.goldLoanTransaction.update({
            where: { id: existing.id },
            data: payload,
          });
          updated++;
        } else {
          await prisma.goldLoanTransaction.create({
            data: {
              loanAccountNumber: row.loanAccountNumber,
              transactionDate: txnDate,
              ...payload,
            },
          });
          inserted++;
        }
      } catch (e) {
        errors.push(`Transaction [${row.loanAccountNumber}]: ${(e as Error).message}`);
      }
    }

    return NextResponse.json({ inserted, updated, errors });
  } catch (err) {
    console.error('[gold-loan upload error]', err);
    return NextResponse.json({ error: 'Internal server error during upload.' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
