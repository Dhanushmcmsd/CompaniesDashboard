/**
 * POST /api/upload/mf-loan
 * Accepts one or more .xlsx files (Balance Statement + Transaction Statement).
 * Detects file type by filename AND header sniffing.
 * Parses, calculates KPIs, and upserts a MfLoanSnapshot in the DB.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession }          from 'next-auth';
import { authOptions }               from '@/lib/auth';
import { prisma }                    from '@/lib/prisma';
import {
  parseMfLoanBalanceStatement,
  parseMfLoanTransactionStatement,
  detectMfFileType,
} from '@/lib/mf-loan/excel-parser';
import {
  calculateMfLoanKPIs,
  calculateMfBranchBreakdown,
} from '@/lib/mf-loan/calculator';
import type { MfLoanBalanceRow, MfLoanTransactionRow } from '@/lib/mf-loan/types';

export const runtime     = 'nodejs';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['EMPLOYEE', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const fd    = await req.formData();
    const files = fd.getAll('files') as File[];
    if (!files.length) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const results: { fileName: string; fileType: string; rowCount: number; status: string; errors: string[] }[] = [];
    let balanceRows: MfLoanBalanceRow[]     = [];
    let txnRows:     MfLoanTransactionRow[] = [];
    const snapshotDate = new Date();

    for (const file of files) {
      const buffer   = Buffer.from(await file.arrayBuffer());
      // Pass buffer so detectMfFileType can sniff headers if filename is generic
      const fileType = detectMfFileType(file.name, buffer);
      const errors: string[] = [];
      let rowCount = 0;

      try {
        if (fileType === 'Balance Statement') {
          const rows  = parseMfLoanBalanceStatement(buffer);
          balanceRows = rows;
          rowCount    = rows.length;
        } else if (fileType === 'Transaction Statement') {
          const rows = parseMfLoanTransactionStatement(buffer);
          txnRows    = rows;
          rowCount   = rows.length;
        } else {
          errors.push(
            `Could not detect file type for "${file.name}". ` +
            `Rename file to include "balance" or "transaction", or ensure correct column headers.`,
          );
        }
      } catch (parseErr: unknown) {
        errors.push(
          parseErr instanceof Error ? parseErr.message : String(parseErr),
        );
      }

      await prisma.uploadBatch.create({
        data: {
          company:      'supra',
          portfolio:    'mf-loan',
          fileType,
          originalName: file.name,
          uploadedBy:   session.user.email ?? 'unknown',
          rowCount,
          status:       errors.length ? 'error' : 'done',
          errors:       errors.length ? errors : null,
        },
      });

      results.push({ fileName: file.name, fileType, rowCount, status: errors.length ? 'error' : 'done', errors });
    }

    // Save snapshot whenever at least a Balance Statement was parsed
    if (balanceRows.length > 0) {
      try {
        const kpis      = calculateMfLoanKPIs(balanceRows, txnRows, snapshotDate);
        const branchAUM = calculateMfBranchBreakdown(balanceRows);
        const batchId   = `mf-supra-${snapshotDate.getTime()}`;

        await prisma.mfLoanSnapshot.upsert({
          where:  { uploadBatchId: batchId },
          create: {
            uploadBatchId:      batchId,
            company:            'supra',
            snapshotDate,
            totalAUM:           kpis.totalAUM,
            totalCustomers:     kpis.totalCustomers,
            avgYield:           kpis.avgYield,
            mtdDisbursement:    kpis.mtdDisbursement,
            ftdDisbursement:    kpis.ftdDisbursement,
            overdueAccounts:    kpis.overdueAccounts,
            overdueAmount:      kpis.overdueAmount,
            gnpaAmount:         kpis.gnpaAmount,
            gnpaPct:            kpis.gnpaPct,
            loanClosureAmount:  kpis.loanClosureAmount,
            ftdCollection:      kpis.ftdCollection,
            mtdCollection:      kpis.mtdCollection,
            ftdDisburseFromTxn: kpis.ftdDisburseFromTxn,
            branchAUM,
          },
          update: {
            ftdCollection:      kpis.ftdCollection,
            mtdCollection:      kpis.mtdCollection,
            ftdDisburseFromTxn: kpis.ftdDisburseFromTxn,
            overdueAccounts:    kpis.overdueAccounts,
            overdueAmount:      kpis.overdueAmount,
            gnpaAmount:         kpis.gnpaAmount,
            gnpaPct:            kpis.gnpaPct,
            loanClosureAmount:  kpis.loanClosureAmount,
          },
        });
      } catch (snapErr) {
        console.error('[mf-loan] Snapshot save error:', snapErr);
      }
    }

    return NextResponse.json({ results }, { status: 200 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 },
    );
  }
}
