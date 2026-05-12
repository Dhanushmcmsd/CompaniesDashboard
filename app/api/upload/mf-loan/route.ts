/**
 * POST /api/upload/mf-loan
 * Accepts one or more .xlsx files (Balance Statement + Transaction Statement).
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

export const runtime    = 'nodejs';
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

    const results = [];
    let balanceRows: MfLoanBalanceRow[]     = [];
    let txnRows:     MfLoanTransactionRow[] = [];
    const snapshotDate = new Date();

    for (const file of files) {
      const fileType = detectMfFileType(file.name);
      const buffer   = Buffer.from(await file.arrayBuffer());
      const errors: string[] = [];
      let rowCount = 0;

      try {
        if (fileType === 'Balance Statement') {
          const rows = parseMfLoanBalanceStatement(buffer);
          balanceRows = rows;
          rowCount    = rows.length;
        } else if (fileType === 'Transaction Statement') {
          const rows = parseMfLoanTransactionStatement(buffer);
          txnRows  = rows;
          rowCount = rows.length;
        } else {
          errors.push(
            `Unknown file type — file name must include "balance" or "transaction".`,
          );
        }
      } catch (parseErr: unknown) {
        errors.push(
          parseErr instanceof Error ? parseErr.message : String(parseErr),
        );
      }

      // Record the upload in UploadBatch
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

      results.push({
        fileName: file.name,
        fileType,
        rowCount,
        status: errors.length ? 'error' : 'done',
        errors,
      });
    }

    // Save snapshot only when at least a Balance Statement was parsed
    if (balanceRows.length > 0) {
      try {
        const kpis      = calculateMfLoanKPIs(balanceRows, txnRows, snapshotDate);
        const branchAUM = calculateMfBranchBreakdown(balanceRows);
        const batchId   = `mf-supra-${snapshotDate.getTime()}`;

        await prisma.mfLoanSnapshot.upsert({
          where: { uploadBatchId: batchId },
          create: {
            uploadBatchId:     batchId,
            company:           'supra',
            snapshotDate,
            totalAUM:          kpis.totalAUM,
            totalCustomers:    kpis.totalCustomers,
            avgYield:          kpis.avgYield,
            mtdDisbursement:   kpis.mtdDisbursement,
            ftdDisbursement:   kpis.ftdDisbursement,
            overdueAccounts:   kpis.overdueAccounts,
            overdueAmount:     kpis.overdueAmount,
            gnpaAmount:        kpis.gnpaAmount,
            gnpaPct:           kpis.gnpaPct,
            loanClosureAmount: kpis.loanClosureAmount,
            ftdCollection:      kpis.ftdCollection,
            mtdCollection:      kpis.mtdCollection,
            ftdDisburseFromTxn: kpis.ftdDisburseFromTxn,
            branchAUM,
          },
          update: {
            // If both files uploaded in separate sessions, patch txn-side fields
            ftdCollection:      kpis.ftdCollection,
            mtdCollection:      kpis.mtdCollection,
            ftdDisburseFromTxn: kpis.ftdDisburseFromTxn,
          },
        });
      } catch (snapErr) {
        console.error('[mf-loan] Snapshot save error:', snapErr);
        // Non-fatal — upload result still returned to employee
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
