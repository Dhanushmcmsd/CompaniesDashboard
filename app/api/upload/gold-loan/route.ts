import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseGoldLoanExcel, auditGoldLoanColumns } from "@/lib/gold-loan/excel-parser";
import { calculateKPIs, calculateKPIsFromTransaction } from "@/lib/gold-loan/calculator";
import { buildUploadErrors, type UploadParseMeta } from "@/lib/upload-errors";
import type { GoldLoanSnapshot, Prisma } from "@prisma/client";

const COMPANY = "supra";

function toDateOnlyUtc(date: Date | null): Date | null {
  if (!date) return null;
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

function formatDate(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

function dayBounds(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function findSnapshotForDate(company: string, snapshotDate: Date) {
  const { start, end } = dayBounds(snapshotDate);
  return prisma.goldLoanSnapshot.findFirst({
    where: { company, snapshotDate: { gte: start, lte: end } },
    orderBy: { createdAt: "desc" },
  });
}

function hasTransactionDisbursement(snap: GoldLoanSnapshot | null): snap is GoldLoanSnapshot {
  return (
    snap != null &&
    (
      snap.newCustomerFromTxn != null ||
      (snap.newDisbursements != null && snap.newDisbursements > 0) ||
      (snap.mtdDisbursements != null && snap.mtdDisbursements > 0)
    )
  );
}

async function createUploadBatch(data: {
  company: string;
  portfolio: string;
  fileType: string;
  originalName: string;
  reportDate: Date | null;
  uploadedBy: string;
  rowCount: number;
  status: string;
  parseMeta: UploadParseMeta;
}) {
  const errorsJson = buildUploadErrors([], data.parseMeta);
  try {
    return await prisma.uploadBatch.create({
      data: {
        company: data.company,
        portfolio: data.portfolio,
        fileType: data.fileType,
        originalName: data.originalName,
        reportDate: data.reportDate,
        uploadedBy: data.uploadedBy,
        rowCount: data.rowCount,
        status: data.status,
        errors: errorsJson,
        parseMeta: data.parseMeta as Prisma.InputJsonValue,
      },
    });
  } catch (e) {
    if (!String((e as Error).message).includes("parseMeta")) throw e;
    return await prisma.uploadBatch.create({
      data: {
        company: data.company,
        portfolio: data.portfolio,
        fileType: data.fileType,
        originalName: data.originalName,
        reportDate: data.reportDate,
        uploadedBy: data.uploadedBy,
        rowCount: data.rowCount,
        status: data.status,
        errors: errorsJson,
      },
    });
  }
}

async function updateUploadBatch(
  id: string,
  data: { status: string; errors: string[]; parseMeta: UploadParseMeta },
) {
  const errorsJson = buildUploadErrors(data.errors, data.parseMeta);
  try {
    await prisma.uploadBatch.update({
      where: { id },
      data: { status: data.status, errors: errorsJson, parseMeta: data.parseMeta as Prisma.InputJsonValue },
    });
  } catch (e) {
    if (!String((e as Error).message).includes("parseMeta")) throw e;
    await prisma.uploadBatch.update({
      where: { id },
      data: { status: data.status, errors: errorsJson },
    });
  }
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

    type Result = {
      fileName: string;
      fileType: string;
      rowCount: number;
      status: string;
      errors: string[];
      matchedColumns: string[];
      missingColumns: string[];
      missingRequired: string[];
      batchId?: string;
    };

    const results: Result[] = [];

    for (const file of files) {
      console.time(file.name);
      const perFileErrors: string[] = [];
      let fileType = "unknown";
      let rowCount = 0;
      let status = "error";
      let batchId: string | null = null;
      let matchedColumns: string[] = [];
      let missingColumns: string[] = [];
      let missingRequired: string[] = [];

      try {
        const buffer = await file.arrayBuffer();
        const parsed = parseGoldLoanExcel(buffer, file.name);
        fileType = parsed.fileType;
        rowCount = parsed.rowCount;
        perFileErrors.push(...parsed.errors, ...parsed.warnings);
        const reportDate = toDateOnlyUtc(parsed.reportDate);
        const snapshotDate = reportDate ?? toDateOnlyUtc(new Date())!;

        const audit = auditGoldLoanColumns(parsed.fileType, parsed.headers);
        matchedColumns = audit.matchedColumns;
        missingColumns = audit.missingColumns;
        missingRequired = audit.missingRequired;

        if (missingRequired.length > 0) {
          perFileErrors.push(
            `Required columns missing: ${missingRequired.join(", ")}. Some rows may be skipped.`,
          );
        } else if (missingColumns.length > 0) {
          perFileErrors.push(
            `Optional columns not found: ${missingColumns.join(", ")} — related KPIs may default to 0.`,
          );
        }

        console.log(
          `[upload] ${file.name} → type=${fileType} rows=${rowCount}`,
          `parsed.reportDate=${formatDate(parsed.reportDate)}`,
          `snapshotDate=${formatDate(snapshotDate)}`,
        );

        const parseMeta: UploadParseMeta = {
          matchedColumns,
          missingColumns,
          missingRequired,
          warnings: parsed.warnings,
        };

        const batch = await createUploadBatch({
          company: COMPANY,
          portfolio: "gold-loan",
          fileType,
          originalName: file.name,
          reportDate,
          uploadedBy: session.user.email ?? "unknown",
          rowCount,
          status: "pending",
          parseMeta,
        });
        batchId = batch.id;

        if (fileType === "unknown") {
          await updateUploadBatch(batch.id, { status: "error", errors: perFileErrors, parseMeta });
          status = "error";
        } else if (fileType === "balance") {
          const existingSnapshot = await findSnapshotForDate(COMPANY, snapshotDate);
          const hasTxnData = hasTransactionDisbursement(existingSnapshot);
          const kpis = calculateKPIs(parsed.rows, [], snapshotDate);
          const overdueAccountNumbers = parsed.overdueAccountNumbers;
          const branchDisbursement = (
            hasTxnData ? existingSnapshot.branchDisbursement ?? [] : kpis.branchDisbursement
          ) as Prisma.InputJsonValue;

          const balancePayload = {
            reportDate,
            snapshotDate,
            totalAUM: kpis.totalAUM,
            totalAccounts: kpis.totalAccounts,
            totalCustomers: kpis.totalCustomers,
            avgTicketSize: kpis.avgTicketSize,
            avgYield: kpis.avgYield,
            totalGoldWeight: kpis.totalGoldWeight,
            avgGoldWeightPerLoan: kpis.avgGoldWeightPerLoan,
            avgRatePerGram: kpis.avgRatePerGram,
            avgLTV: kpis.avgLTV,
            avgPresentRate: kpis.avgPresentRate,
            avgGoldValuePerLoan: kpis.avgGoldValuePerLoan,
            newCustomerFromLoanBalance: kpis.newCustomerFromLoanBalance,
            newDisbursements: hasTxnData
              ? Math.max(existingSnapshot.newDisbursements ?? 0, kpis.newDisbursements)
              : kpis.newDisbursements,
            mtdDisbursements: hasTxnData
              ? Math.max(existingSnapshot.mtdDisbursements ?? 0, kpis.calendarMonthDisbursements)
              : kpis.calendarMonthDisbursements,
            ytdDisbursements: hasTxnData
              ? Math.max(existingSnapshot.ytdDisbursements ?? 0, kpis.mtdDisbursements)
              : kpis.mtdDisbursements,
            gnpaAmount: kpis.gnpaAmount,
            gnpaPct: kpis.gnpaPct,
            nnpaPct: kpis.nnpaPct,
            totalOverdue: kpis.totalOverdue,
            overdueCollection: kpis.overdueCollection,
            collectionEfficiency: kpis.collectionEfficiency,
            overduePercent: kpis.overduePercent,
            bucket0to30: kpis.bucket0to30,
            bucket31to60: kpis.bucket31to60,
            bucket61to90: kpis.bucket61to90,
            bucket90plus: kpis.bucket90plus,
            sma0Amount: kpis.sma0Amount,
            sma1Amount: kpis.sma1Amount,
            sma2Amount: kpis.sma2Amount,
            sma0Count: kpis.sma0Count,
            sma1Count: kpis.sma1Count,
            sma2Count: kpis.sma2Count,
            highRiskAmount: kpis.highRiskAmount,
            highRiskCount: kpis.highRiskCount,
            branchAUM: kpis.branchAUM as Prisma.InputJsonValue,
            productAUM: kpis.productAUM as Prisma.InputJsonValue,
            branchDisbursement,
            branchNPA: kpis.branchNPA as Prisma.InputJsonValue,
            branchGoldWeight: kpis.branchGoldWeight as Prisma.InputJsonValue,
            highLTVAccounts: kpis.highLTVAccounts,
            goldValueMismatch: kpis.goldValueMismatch,
            auctionCases: kpis.auctionCases,
            overdueAccountNumbers: overdueAccountNumbers as Prisma.InputJsonValue,
          };

          console.log(
            `[upload] ${file.name} → balance KPIs:`,
            `snapshotDate=${formatDate(snapshotDate)}`,
            `newDisbursements=${balancePayload.newDisbursements.toFixed(2)}`,
            `mtdDisbursements=${balancePayload.mtdDisbursements.toFixed(2)}`,
            `preservedTxn=${hasTxnData}`,
          );

          if (existingSnapshot) {
            await prisma.goldLoanSnapshot.update({
              where: { id: existingSnapshot.id },
              data: balancePayload,
            });
          } else {
            await prisma.goldLoanSnapshot.create({
              data: {
                uploadBatchId: batch.id,
                company: COMPANY,
                ...balancePayload,
              },
            });
          }

          await updateUploadBatch(batch.id, { status: "done", errors: perFileErrors, parseMeta });
          console.log(`[upload] ${file.name} → balance KPI snapshot saved`);
          status = missingRequired.length > 0 ? "warning" : "done";
        } else if (fileType === "transaction") {
          let matchingSnapshot = await findSnapshotForDate(COMPANY, snapshotDate);

          if (!matchingSnapshot) {
            const threeDaysAgo = new Date(snapshotDate);
            threeDaysAgo.setUTCDate(threeDaysAgo.getUTCDate() - 3);
            const threeDaysAhead = new Date(snapshotDate);
            threeDaysAhead.setUTCDate(threeDaysAhead.getUTCDate() + 3);

            matchingSnapshot = await prisma.goldLoanSnapshot.findFirst({
              where: {
                company: COMPANY,
                totalAUM: { gt: 0 },
                snapshotDate: {
                  gte: threeDaysAgo,
                  lte: threeDaysAhead,
                },
              },
              orderBy: { snapshotDate: "desc" },
            });
          }

          const storedOverdue = matchingSnapshot?.overdueAccountNumbers;
          const overdueArr: string[] = Array.isArray(storedOverdue)
            ? (storedOverdue as string[])
            : [];
          const overdueSet = new Set<string>(overdueArr);

          const txnKPIs = calculateKPIsFromTransaction(parsed.rows, overdueSet, snapshotDate);

          console.log(
            `[upload] ${file.name} → txn KPIs:`,
            `snapshotDate=${formatDate(snapshotDate)}`,
            `disbursed=${txnKPIs.totalDisbursed.toFixed(2)}`,
            `collected=${txnKPIs.totalCollected.toFixed(2)}`,
            `overdueCollection=${txnKPIs.overdueCollectionFromTxn.toFixed(2)}`,
            `branches=${txnKPIs.branchDisbursementFromTxn.length}`,
          );

          const { calculateTransactionKPIs: calcTxnKPIs } = await import(
            "@/lib/gold-loan/transaction-calculator"
          );
          const fullTxnKPIs = calcTxnKPIs(
            parsed.rows,
            [],
            matchingSnapshot?.totalOverdue ?? 0,
            snapshotDate,
          );

          const branchDisbForSnapshot = fullTxnKPIs.branchDisbursements.map((b) => ({
            branch: b.branch,
            ftd: b.ftd,
            mtd: b.mtd,
            ytd: b.ytd,
          }));

          if (matchingSnapshot) {
            const totalOverdue = matchingSnapshot.totalOverdue;
            const newODCollection = txnKPIs.overdueCollectionFromTxn;
            const newEfficiency =
              totalOverdue > 0 ? (newODCollection / totalOverdue) * 100 : null;

            await prisma.goldLoanSnapshot.update({
              where: { id: matchingSnapshot.id },
              data: {
                reportDate: matchingSnapshot.reportDate ?? reportDate,
                snapshotDate,
                overdueCollection: newODCollection,
                collectionEfficiency: newEfficiency,
                branchDisbursement: branchDisbForSnapshot as Prisma.InputJsonValue,
                dailyDisbursements: fullTxnKPIs.dailyDisbursements as Prisma.InputJsonValue,
                newDisbursements: fullTxnKPIs.ftdDisbursement,
                mtdDisbursements: fullTxnKPIs.calendarMonthDisbursement,
                ytdDisbursements: fullTxnKPIs.mtdDisbursement,
                newCustomerFromTxn: txnKPIs.newCustomerFromTxn,
              },
            });

            console.log(
              `[upload] Patched snapshot ${matchingSnapshot.id}:`,
              `collectionEfficiency=${newEfficiency != null ? newEfficiency.toFixed(2) + "%" : "null"}`,
              `snapshotDate=${formatDate(snapshotDate)}`,
              `ftdDisb=${fullTxnKPIs.ftdDisbursement.toFixed(2)}`,
              `mtdDisb=${fullTxnKPIs.calendarMonthDisbursement.toFixed(2)}`,
              `ytdDisb=${fullTxnKPIs.mtdDisbursement.toFixed(2)}`,
            );
          } else {
            await prisma.goldLoanSnapshot.create({
              data: {
                uploadBatchId: batch.id,
                company: COMPANY,
                reportDate,
                snapshotDate,
                totalAUM: 0,
                totalAccounts: 0,
                totalCustomers: 0,
                avgTicketSize: 0,
                avgYield: 0,
                totalGoldWeight: 0,
                avgGoldWeightPerLoan: 0,
                avgLTV: 0,
                avgPresentRate: 0,
                avgGoldValuePerLoan: 0,
                avgRatePerGram: 0,
                highRiskAmount: 0,
                highRiskCount: 0,
                newCustomerFromLoanBalance: 0,
                newCustomerFromTxn: txnKPIs.newCustomerFromTxn,
                newDisbursements: fullTxnKPIs.ftdDisbursement,
                mtdDisbursements: fullTxnKPIs.calendarMonthDisbursement,
                ytdDisbursements: fullTxnKPIs.mtdDisbursement,
                gnpaAmount: 0,
                gnpaPct: 0,
                nnpaPct: 0,
                totalOverdue: 0,
                overdueCollection: fullTxnKPIs.overdueCollection,
                collectionEfficiency: null,
                overduePercent: 0,
                bucket0to30: 0,
                bucket31to60: 0,
                bucket61to90: 0,
                bucket90plus: 0,
                sma0Amount: 0,
                sma1Amount: 0,
                sma2Amount: 0,
                sma0Count: 0,
                sma1Count: 0,
                sma2Count: 0,
                branchAUM: [],
                productAUM: [],
                branchDisbursement: branchDisbForSnapshot,
                dailyDisbursements: fullTxnKPIs.dailyDisbursements as Prisma.InputJsonValue,
                branchNPA: [],
                branchGoldWeight: [],
                highLTVAccounts: 0,
                goldValueMismatch: 0,
                auctionCases: 0,
                overdueAccountNumbers: [],
              },
            });

            console.log(
              `[upload] Created transaction-only snapshot:`,
              `snapshotDate=${formatDate(snapshotDate)}`,
              `newDisbursements=${fullTxnKPIs.ftdDisbursement.toFixed(2)}`,
              `mtdDisbursements=${fullTxnKPIs.calendarMonthDisbursement.toFixed(2)}`,
              `newCustomerFromTxn=${txnKPIs.newCustomerFromTxn}`,
            );

            perFileErrors.push(
              "No balance-sheet snapshot found for this company. " +
                "Balance sheet KPIs will be unavailable until the Loan Balance Statement is uploaded. " +
                "Disbursement data is saved from the transaction file only.",
            );
          }

          await updateUploadBatch(batch.id, { status: "done", errors: perFileErrors, parseMeta });
          status = missingRequired.length > 0 ? "warning" : "done";
        } else {
          perFileErrors.push(
            `File type "${fileType}" received. Interest-extract files will be processed ` +
              `in a future update. No data stored.`,
          );
          await updateUploadBatch(batch.id, { status: "noted", errors: perFileErrors, parseMeta });
          status = "noted";
        }
      } catch (e) {
        const msg = `Error processing ${file.name}: ${(e as Error).message}`;
        console.error(msg, e);
        perFileErrors.push(msg);
        if (batchId) {
          await updateUploadBatch(batchId, {
            status: "error",
            errors: perFileErrors,
            parseMeta: { matchedColumns, missingColumns, missingRequired },
          }).catch(() => undefined);
        }
        status = "error";
      } finally {
        console.timeEnd(file.name);
      }

      results.push({
        fileName: file.name,
        fileType,
        rowCount,
        status,
        errors: perFileErrors,
        matchedColumns,
        missingColumns,
        missingRequired,
        batchId: batchId ?? undefined,
      });
    }

    return NextResponse.json({ results }, { status: 200 });
  } catch (e) {
    console.error("[upload] top-level crash:", e);
    return NextResponse.json(
      { error: `Unexpected server error: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
