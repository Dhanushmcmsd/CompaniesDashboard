import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseGoldLoanExcel } from "@/lib/gold-loan/excel-parser";

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function toDate(v: unknown): Date | null {
  return v instanceof Date ? v : null;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !["EMPLOYEE", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const multi = formData.getAll("files[]").filter((f): f is File => f instanceof File);
  const singles = ["balanceFile", "transactionFile"].map((k) => formData.get(k)).filter((f): f is File => f instanceof File);
  const files = multi.length ? multi : singles;

  if (!files.length) {
    return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
  }

  const results: Array<{ fileName: string; fileType: string; reportDate: string | null; inserted: number; updated: number; errors: string[]; rowCount: number }> = [];
  let totalInserted = 0;
  let totalUpdated = 0;

  for (const file of files) {
    const parsed = parseGoldLoanExcel(await file.arrayBuffer());
    const errors = [...parsed.errors];

    if (parsed.fileType === "unknown") {
      results.push({ fileName: file.name, fileType: "unknown", reportDate: null, inserted: 0, updated: 0, errors, rowCount: 0 });
      continue;
    }

    const batch = await prisma.uploadBatch.create({
      data: {
        company: "supra",
        portfolio: "gold-loan",
        fileType: parsed.fileType,
        originalName: file.name,
        reportDate: parsed.reportDate,
        uploadedBy: session.user.email,
        rowCount: parsed.rowCount,
      },
    });

    let inserted = 0;
    let updated = 0;

    if (parsed.fileType === "balance") {
      for (const pack of chunk(parsed.rows, 500)) {
        for (const r of pack) {
          const loanAccountNumber = String(r.loanAccountNumber ?? "").trim();
          if (!loanAccountNumber) {
            errors.push("Missing loanAccountNumber row skipped");
            continue;
          }
          try {
            const existing = await prisma.goldLoanBalance.findUnique({ where: { loanAccountNumber } });
            const data = {
              ...r,
              loanAccountNumber,
              uploadBatchId: batch.id,
              reportDate: parsed.reportDate,
            };
            await prisma.goldLoanBalance.upsert({
              where: { loanAccountNumber },
              create: data,
              update: data,
            });
            if (existing) updated += 1; else inserted += 1;
          } catch (e) {
            errors.push(`Balance upsert failed for ${loanAccountNumber}: ${(e as Error).message}`);
          }
        }
      }
    }

    if (parsed.fileType === "transaction" || parsed.fileType === "interest-extract") {
      const rows = parsed.rows.filter((r) => r.loanAccountNumber && r.transactionDate);
      const accountNums = Array.from(new Set(rows.map((r) => String(r.loanAccountNumber))));
      const dates = rows.map((r) => toDate(r.transactionDate)).filter((d): d is Date => Boolean(d));
      const minDate = dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
      const maxDate = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;

      await prisma.$transaction(async (tx) => {
        if (accountNums.length && minDate && maxDate) {
          await tx.goldLoanTransaction.deleteMany({
            where: {
              loanAccountNumber: { in: accountNums },
              transactionDate: { gte: minDate, lte: maxDate },
            },
          });
        }

        for (const pack of chunk(rows, 500)) {
          const createData = pack.map((r) => ({
            loanAccountNumber: String(r.loanAccountNumber),
            transactionDate: r.transactionDate as Date,
            principalReceived: (r.principalReceived as number | null) ?? null,
            interestReceived: (r.interestReceived as number | null) ?? null,
            principalInterestReceived: (r.principalInterestReceived as number | null) ?? null,
            otherCharges: (r.otherCharges as number | null) ?? null,
            totalAmountReceived: (r.totalAmountReceived as number | null) ?? null,
          }));
          if (createData.length) {
            await tx.goldLoanTransaction.createMany({ data: createData });
            inserted += createData.length;
          }
        }
      });
    }

    await prisma.uploadBatch.update({
      where: { id: batch.id },
      data: { inserted, updated, errors },
    });

    totalInserted += inserted;
    totalUpdated += updated;
    results.push({
      fileName: file.name,
      fileType: parsed.fileType,
      reportDate: parsed.reportDate ? parsed.reportDate.toISOString() : null,
      inserted,
      updated,
      errors,
      rowCount: parsed.rowCount,
    });
  }

  return NextResponse.json({ results, totalInserted, totalUpdated });
}
