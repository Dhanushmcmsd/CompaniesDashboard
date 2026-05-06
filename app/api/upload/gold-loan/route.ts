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

async function processBalanceRows(rows: Record<string, unknown>[], uploadBatchId: string, reportDate: Date | null) {
  let inserted = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const group of chunk(rows, 200)) {
    const accountNumbers = group
      .map((r) => String(r.loanAccountNumber ?? "").trim())
      .filter(Boolean);

    const existing = await prisma.goldLoanBalance.findMany({
      where: { loanAccountNumber: { in: accountNumbers } },
      select: { loanAccountNumber: true },
    });
    const existingSet = new Set(existing.map((e) => e.loanAccountNumber));

    await Promise.all(
      group.map(async (r) => {
        const loanAccountNumber = String(r.loanAccountNumber ?? "").trim();
        if (!loanAccountNumber) {
          errors.push("Missing loanAccountNumber");
          return;
        }

        const data = {
          loanAccountNumber,
          customerId: (r.customerId as string | null) ?? null,
          customerName: (r.customerName as string | null) ?? null,
          branchName: (r.branchName as string | null) ?? null,
          branchState: (r.branchState as string | null) ?? null,
          branchRegion: (r.branchRegion as string | null) ?? null,
          schemeName: (r.schemeName as string | null) ?? null,
          disbursementDate: (r.disbursementDate as Date | null) ?? null,
          disbursedAmount: (r.disbursedAmount as number | null) ?? null,
          openingBalance: (r.openingBalance as number | null) ?? null,
          principalDr: (r.principalDr as number | null) ?? null,
          principalCr: (r.principalCr as number | null) ?? null,
          closingBalance: (r.closingBalance as number | null) ?? null,
          interestRcvd: (r.interestRcvd as number | null) ?? null,
          interestRcvDuring: (r.interestRcvDuring as number | null) ?? null,
          goldWeight: (r.goldWeight as number | null) ?? null,
          grossWt: (r.grossWt as number | null) ?? null,
          presentRate: (r.presentRate as number | null) ?? null,
          interestRate: (r.interestRate as number | null) ?? null,
          totalOutstanding: (r.totalOutstanding as number | null) ?? null,
          dpd: ((r.dpd as number | null) ?? null) as number | null,
          uploadBatchId,
          reportDate,
        };

        try {
          await prisma.goldLoanBalance.upsert({
            where: { loanAccountNumber },
            create: data,
            update: data,
          });
          if (existingSet.has(loanAccountNumber)) updated += 1;
          else inserted += 1;
        } catch (e) {
          errors.push(`Balance ${loanAccountNumber}: ${(e as Error).message}`);
        }
      })
    );
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
      loanAccountNumber: String(r.loanAccountNumber),
      transactionDate: r.transactionDate as Date,
      principalReceived: (r.principalReceived as number | null) ?? null,
      interestReceived: (r.interestReceived as number | null) ?? null,
      otherCharges: (r.otherCharges as number | null) ?? null,
      totalAmountReceived:
        (r.totalAmountReceived as number | null) ??
        (((r.principalReceived as number | null) ?? 0) + ((r.interestReceived as number | null) ?? 0) + ((r.otherCharges as number | null) ?? 0)),
      principalInterestReceived:
        (r.principalInterestReceived as number | null) ??
        (((r.principalReceived as number | null) ?? 0) + ((r.interestReceived as number | null) ?? 0)),
    }));

    try {
      if (data.length) {
        await prisma.goldLoanTransaction.createMany({ data });
        inserted += data.length;
      }
    } catch (e) {
      errors.push(`Transaction chunk error: ${(e as Error).message}`);
    }
  }

  return { inserted, updated, errors };
}

async function processInterestExtractRows(rows: Record<string, unknown>[]) {
  const normalized = rows.map((r) => {
    const p = (r.principalReceived as number | null) ?? (r.principalCr as number | null) ?? 0;
    const i = (r.interestReceived as number | null) ?? (r.interestRcvd as number | null) ?? 0;
    return {
      ...r,
      principalReceived: p,
      interestReceived: i,
      otherCharges: 0,
      totalAmountReceived: p + i,
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
        const parsed = parseGoldLoanExcel(await file.arrayBuffer(), file.name);
        fileType = parsed.fileType;
        rowCount = parsed.rowCount;
        perFileErrors.push(...parsed.errors);

        const batch = await prisma.uploadBatch.create({
          data: {
            company: "supra",
            portfolio: "gold-loan",
            fileType,
            originalName: file.name,
            reportDate: parsed.reportDate,
            uploadedBy: session.user.email,
            rowCount,
          },
        });

        if (fileType === "balance") {
          const res = await processBalanceRows(parsed.rows, batch.id, parsed.reportDate);
          inserted = res.inserted;
          updated = res.updated;
          perFileErrors.push(...res.errors);
        } else if (fileType === "transaction") {
          const res = await processTransactionRows(parsed.rows);
          inserted = res.inserted;
          updated = res.updated;
          perFileErrors.push(...res.errors);
        } else if (fileType === "interest-extract") {
          const res = await processInterestExtractRows(parsed.rows);
          inserted = res.inserted;
          updated = res.updated;
          perFileErrors.push(...res.errors);
        } else {
          perFileErrors.push("Unknown file type, file skipped.");
        }

        await prisma.uploadBatch.update({
          where: { id: batch.id },
          data: { inserted, updated, errors: perFileErrors },
        });

        totalInserted += inserted;
        totalUpdated += updated;
      } catch (e) {
        perFileErrors.push((e as Error).message);
      } finally {
        console.timeEnd(file.name);
      }

      results.push({
        fileName: file.name,
        fileType,
        rowCount,
        inserted,
        updated,
        errors: perFileErrors,
      });
    }

    return NextResponse.json({ results, totalInserted, totalUpdated }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: `Unexpected server error: ${(e as Error).message}` }, { status: 500 });
  }
}
