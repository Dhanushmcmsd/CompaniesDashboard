import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseGoldLoanExcel } from "@/lib/gold-loan/excel-parser";

type Result = {
  fileName: string;
  fileType: string;
  rowCount: number;
  inserted: number;
  updated: number;
  errors: string[];
};

function chunk<T>(arr: T[], size: number): T[][] {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
  return res;
}

/** Cast a parsed float to Int for dpd — rounds to nearest integer */
function toInt(v: unknown): number | null {
  const n = v == null ? null : Math.round(Number(v));
  return n != null && Number.isFinite(n) ? n : null;
}

function toFloat(v: unknown): number | null {
  if (v == null) return null;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function toStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function toDate(v: unknown): Date | null {
  if (v == null) return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  return null;
}

function toData(
  r: Record<string, unknown>,
  uploadBatchId: string,
  reportDate: Date | null
) {
  return {
    loanAccountNumber:  String(r.loanAccountNumber).trim(),
    customerId:         toStr(r.customerId),
    customerName:       toStr(r.customerName),
    branchName:         toStr(r.branchName),
    branchState:        toStr(r.branchState),
    branchRegion:       toStr(r.branchRegion),
    schemeName:         toStr(r.schemeName),
    schemeCode:         toStr(r.schemeCode),
    branchCode:         toStr(r.branchCode),
    inventoryNo:        toStr(r.inventoryNo),
    disbursementDate:   toDate(r.disbursementDate),
    maturityDate:       toDate(r.maturityDate),
    inventoryDate:      toDate(r.inventoryDate),
    disbursedAmount:    toFloat(r.disbursedAmount),
    openingBalance:     toFloat(r.openingBalance),
    principalDr:        toFloat(r.principalDr),
    principalCr:        toFloat(r.principalCr),         // ← was missing before
    closingBalance:     toFloat(r.closingBalance),
    interestRcvd:       toFloat(r.interestRcvd),
    interestRcvDuring:  toFloat(r.interestRcvDuring),
    goldWeight:         toFloat(r.goldWeight),
    grossWt:            toFloat(r.grossWt),
    goldPurity:         toFloat(r.goldPurity),
    presentRate:        toFloat(r.presentRate),
    interestRate:       toFloat(r.interestRate),
    totalOutstanding:   toFloat(r.totalOutstanding),
    totalInterestDue:   toFloat(r.totalInterestDue),
    dpd:                toInt(r.dpd),                   // ← schema is Int?, must NOT pass Float
    uploadBatchId,
    reportDate,
  };
}

async function processBalanceRows(
  rows: Record<string, unknown>[],
  uploadBatchId: string,
  reportDate: Date | null
) {
  let inserted = 0;
  let updated = 0;
  const errors: string[] = [];

  const validRows = rows.filter((r) => {
    const acc = String(r.loanAccountNumber ?? "").trim();
    if (!acc || acc === "null" || acc === "undefined") {
      errors.push("Skipped row: missing loanAccountNumber");
      return false;
    }
    return true;
  });

  console.log(`[balance] valid rows to write: ${validRows.length}`);

  for (const group of chunk(validRows, 300)) {
    const accountNumbers = group.map((r) => String(r.loanAccountNumber).trim());

    const existing = await prisma.goldLoanBalance.findMany({
      where: { loanAccountNumber: { in: accountNumbers } },
      select: { loanAccountNumber: true },
    });
    const existingSet = new Set(existing.map((e) => e.loanAccountNumber));

    const toCreate = group.filter((r) => !existingSet.has(String(r.loanAccountNumber).trim()));
    const toUpdate = group.filter((r) =>  existingSet.has(String(r.loanAccountNumber).trim()));

    // Bulk insert brand-new rows
    if (toCreate.length) {
      try {
        const res = await prisma.goldLoanBalance.createMany({
          data: toCreate.map((r) => toData(r, uploadBatchId, reportDate)),
          skipDuplicates: true,
        });
        inserted += res.count;
        console.log(`[balance] createMany inserted ${res.count}`);
      } catch (e) {
        const msg = `Bulk insert error: ${(e as Error).message}`;
        console.error(msg);
        errors.push(msg);
      }
    }

    // Update existing rows
    for (const r of toUpdate) {
      const loanAccountNumber = String(r.loanAccountNumber).trim();
      try {
        await prisma.goldLoanBalance.update({
          where: { loanAccountNumber },
          data: toData(r, uploadBatchId, reportDate),
        });
        updated += 1;
      } catch (e) {
        const msg = `Update ${loanAccountNumber}: ${(e as Error).message}`;
        console.error(msg);
        errors.push(msg);
      }
    }
  }

  return { inserted, updated, errors };
}

async function processTransactionRows(rows: Record<string, unknown>[]) {
  let inserted = 0;
  const updated = 0;
  const errors: string[] = [];

  const cleanRows = rows.filter((r) => r.loanAccountNumber && r.transactionDate);
  const accountNumbers = Array.from(new Set(cleanRows.map((r) => String(r.loanAccountNumber))));
  const dates = cleanRows.map((r) => r.transactionDate as Date).filter((d) => d instanceof Date);
  const minDate = dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
  const maxDate = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;

  if (accountNumbers.length && minDate && maxDate) {
    await prisma.goldLoanTransaction.deleteMany({
      where: {
        loanAccountNumber: { in: accountNumbers },
        transactionDate: { gte: minDate, lte: maxDate },
      },
    });
  }

  for (const group of chunk(cleanRows, 500)) {
    const data = group.map((r) => ({
      loanAccountNumber:         String(r.loanAccountNumber),
      transactionDate:           r.transactionDate as Date,
      principalReceived:         toFloat(r.principalReceived),
      interestReceived:          toFloat(r.interestReceived),
      otherCharges:              toFloat(r.otherCharges),
      totalAmountReceived:
        toFloat(r.totalAmountReceived) ??
        ((toFloat(r.principalReceived) ?? 0) +
         (toFloat(r.interestReceived)  ?? 0) +
         (toFloat(r.otherCharges)       ?? 0)),
      principalInterestReceived:
        toFloat(r.principalInterestReceived) ??
        ((toFloat(r.principalReceived) ?? 0) +
         (toFloat(r.interestReceived)  ?? 0)),
    }));

    try {
      if (data.length) {
        await prisma.goldLoanTransaction.createMany({ data });
        inserted += data.length;
      }
    } catch (e) {
      const msg = `Transaction chunk error: ${(e as Error).message}`;
      console.error(msg);
      errors.push(msg);
    }
  }

  return { inserted, updated, errors };
}

async function processInterestExtractRows(rows: Record<string, unknown>[]) {
  const normalized = rows.map((r) => {
    const p = toFloat(r.principalReceived) ?? toFloat(r.principalCr) ?? 0;
    const i = toFloat(r.interestReceived)  ?? toFloat(r.interestRcvd)  ?? 0;
    return {
      ...r,
      principalReceived:         p,
      interestReceived:          i,
      otherCharges:              0,
      totalAmountReceived:       p + i,
      principalInterestReceived: p + i,
    };
  });
  return processTransactionRows(normalized);
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["EMPLOYEE", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const files = [
      ...formData.getAll("files").filter((f): f is File => f instanceof File),
      ...formData.getAll("files[]").filter((f): f is File => f instanceof File),
    ];

    if (!files.length) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    const results: Result[] = [];
    let totalInserted = 0;
    let totalUpdated = 0;

    for (const file of files) {
      console.time(file.name);
      const perFileErrors: string[] = [];
      let inserted = 0;
      let updated = 0;
      let fileType = "unknown";
      let rowCount = 0;

      try {
        const buffer = await file.arrayBuffer();
        const parsed = parseGoldLoanExcel(buffer, file.name);
        fileType = parsed.fileType;
        rowCount = parsed.rowCount;
        perFileErrors.push(...parsed.errors);

        console.log(`[upload] ${file.name} → type=${fileType} rows=${rowCount}`);

        const batchData = {
          company: "supra",
          portfolio: "gold-loan",
          fileType,
          originalName: file.name,
          reportDate: parsed.reportDate,
          uploadedBy: session.user.email ?? "unknown",
          rowCount,
        };

        const batch = await prisma.uploadBatch.create({ data: batchData });

        if (fileType === "balance") {
          const res = await processBalanceRows(parsed.rows, batch.id, parsed.reportDate);
          inserted = res.inserted;
          updated  = res.updated;
          perFileErrors.push(...res.errors);
        } else if (fileType === "transaction") {
          const res = await processTransactionRows(parsed.rows);
          inserted = res.inserted;
          updated  = res.updated;
          perFileErrors.push(...res.errors);
        } else if (fileType === "interest-extract") {
          const res = await processInterestExtractRows(parsed.rows);
          inserted = res.inserted;
          updated  = res.updated;
          perFileErrors.push(...res.errors);
        } else {
          perFileErrors.push(
            `Unknown file type — file skipped. Detected headers: ${parsed.headers.slice(0, 10).join(", ")}`
          );
        }

        console.log(`[upload] ${file.name} → inserted=${inserted} updated=${updated} errors=${perFileErrors.length}`);

        await prisma.uploadBatch.update({
          where: { id: batch.id },
          data: { inserted, updated, errors: perFileErrors },
        });

        totalInserted += inserted;
        totalUpdated  += updated;
      } catch (e) {
        const msg = `Unexpected error processing ${file.name}: ${(e as Error).message}`;
        console.error(msg, e);
        perFileErrors.push(msg);
      } finally {
        console.timeEnd(file.name);
      }

      results.push({ fileName: file.name, fileType, rowCount, inserted, updated, errors: perFileErrors });
    }

    return NextResponse.json({ results, totalInserted, totalUpdated }, { status: 200 });
  } catch (e) {
    console.error("[upload] top-level crash:", e);
    return NextResponse.json(
      { error: `Unexpected server error: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
