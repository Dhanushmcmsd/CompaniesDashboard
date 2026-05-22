import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseGoldLoanExcel } from "@/lib/gold-loan/excel-parser";
import { calculateKPIs, calculateKPIsFromTransaction } from "@/lib/gold-loan/calculator";

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
    };

    const results: Result[] = [];

    for (const file of files) {
      console.time(file.name);
      const perFileErrors: string[] = [];
      let fileType = "unknown";
      let rowCount = 0;
      let status = "error";

      try {
        const buffer = await file.arrayBuffer();
        const parsed = parseGoldLoanExcel(buffer, file.name);
        fileType = parsed.fileType;
        rowCount = parsed.rowCount;
        perFileErrors.push(...parsed.errors);

        console.log(`[upload] ${file.name} → type=${fileType} rows=${rowCount}`);

        const batch = await prisma.uploadBatch.create({
          data: {
            company: "supra",
            portfolio: "gold-loan",
            fileType,
            originalName: file.name,
            reportDate: parsed.reportDate,
            uploadedBy: session.user.email ?? "unknown",
            rowCount,
            status: "pending",
          },
        });

        if (fileType === "unknown") {
          await prisma.uploadBatch.update({
            where: { id: batch.id },
            data: { status: "error", errors: perFileErrors },
          });
          status = "error";
        } else if (fileType === "balance") {
          const kpis = calculateKPIs(parsed.rows, [], parsed.reportDate ?? new Date());
          const overdueAccountNumbers = parsed.overdueAccountNumbers;

          const balancePayload = {
            reportDate: parsed.reportDate,
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
            newDisbursements: kpis.newDisbursements,
            mtdDisbursements: kpis.mtdDisbursements,
            ytdDisbursements: 0,
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
            branchAUM: kpis.branchAUM,
            productAUM: kpis.productAUM,
            branchDisbursement: kpis.branchDisbursement,
            branchNPA: kpis.branchNPA,
            branchGoldWeight: kpis.branchGoldWeight,
            highLTVAccounts: kpis.highLTVAccounts,
            goldValueMismatch: kpis.goldValueMismatch,
            auctionCases: kpis.auctionCases,
            overdueAccountNumbers,
          };

          await prisma.goldLoanSnapshot.upsert({
            where: { uploadBatchId: batch.id },
            create: {
              uploadBatchId: batch.id,
              company: "supra",
              ...balancePayload,
            },
            update: balancePayload,
          });

          await prisma.uploadBatch.update({
            where: { id: batch.id },
            data: { status: "done", errors: perFileErrors },
          });
          console.log(`[upload] ${file.name} → balance KPI snapshot saved`);
          status = "done";
        } else if (fileType === "transaction") {
          const latestSnapshot = await prisma.goldLoanSnapshot.findFirst({
            where: { company: "supra" },
            orderBy: { snapshotDate: "desc" },
            select: { id: true, totalOverdue: true, overdueAccountNumbers: true },
          });

          const storedOverdue = latestSnapshot?.overdueAccountNumbers;
          const overdueArr: string[] = Array.isArray(storedOverdue)
            ? (storedOverdue as string[])
            : [];
          const overdueSet = new Set<string>(overdueArr);

          const txnKPIs = calculateKPIsFromTransaction(parsed.rows, overdueSet, parsed.reportDate ?? new Date());

          console.log(
            `[upload] ${file.name} → txn KPIs:`,
            `disbursed=${txnKPIs.totalDisbursed.toFixed(2)}`,
            `collected=${txnKPIs.totalCollected.toFixed(2)}`,
            `overdueCollection=${txnKPIs.overdueCollectionFromTxn.toFixed(2)}`,
            `branches=${txnKPIs.branchDisbursementFromTxn.length}`
          );

            const { calculateTransactionKPIs: calcTxnKPIs } = await import(
              "@/lib/gold-loan/transaction-calculator"
            );
            const fullTxnKPIs = calcTxnKPIs(
              parsed.rows,
              [],
              latestSnapshot?.totalOverdue ?? 0,
              parsed.reportDate ?? new Date(),
            );

            const branchDisbForSnapshot = fullTxnKPIs.branchDisbursements.map((b) => ({
              branch: b.branch,
              ftd: b.ftd,
              mtd: b.mtd,
              ytd: b.ytd,
            }));

            if (latestSnapshot) {
              const totalOverdue = latestSnapshot.totalOverdue;
              const newODCollection = txnKPIs.overdueCollectionFromTxn;
              const newEfficiency =
                totalOverdue > 0 ? (newODCollection / totalOverdue) * 100 : null;

              await prisma.$executeRawUnsafe(
                `UPDATE gold_loan_snapshots
                 SET "overdueCollection" = $1,
                     "collectionEfficiency" = $2,
                     "branchDisbursement" = $3::jsonb,
                     "newDisbursements" = $4,
                     "mtdDisbursements" = $5,
                     "ytdDisbursements" = $6,
                     "newCustomerFromTxn" = $7
                 WHERE id = $8`,
                newODCollection,
                newEfficiency,
                JSON.stringify(branchDisbForSnapshot),
                fullTxnKPIs.ftdDisbursement,
                fullTxnKPIs.mtdDisbursement,
                fullTxnKPIs.calendarMonthDisbursement,
                txnKPIs.newCustomerFromTxn,
                latestSnapshot.id,
              );

              console.log(
                `[upload] Patched snapshot ${latestSnapshot.id}:`,
                `collectionEfficiency=${newEfficiency != null ? newEfficiency.toFixed(2) + '%' : 'null'}`,
                `ftdDisb=${fullTxnKPIs.ftdDisbursement.toFixed(2)}`,
                `mtdDisb=${fullTxnKPIs.mtdDisbursement.toFixed(2)}`,
                `calendarMonthDisb=${fullTxnKPIs.calendarMonthDisbursement.toFixed(2)}`
              );
            } else {
              await prisma.goldLoanSnapshot.create({
                data: {
                  uploadBatchId: batch.id,
                  company: "supra",
                  reportDate: parsed.reportDate,
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
                  mtdDisbursements: fullTxnKPIs.mtdDisbursement,
                  ytdDisbursements: 0,
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
                  branchNPA: [],
                  branchGoldWeight: [],
                  highLTVAccounts: 0,
                  goldValueMismatch: 0,
                  auctionCases: 0,
                  overdueAccountNumbers: [],
                },
              });

              perFileErrors.push(
                "No balance-sheet snapshot found for this company. " +
                  "Balance sheet KPIs will be unavailable until the Loan Balance Statement is uploaded. " +
                  "Disbursement data is saved from the transaction file only."
              );
            }

          await prisma.uploadBatch.update({
            where: { id: batch.id },
            data: { status: "done", errors: perFileErrors },
          });
          status = "done";
        } else {
          perFileErrors.push(
            `File type "${fileType}" received. Interest-extract files will be processed ` +
              `in a future update. No data stored.`
          );
          await prisma.uploadBatch.update({
            where: { id: batch.id },
            data: { status: "noted", errors: perFileErrors },
          });
          status = "noted";
        }
      } catch (e) {
        const msg = `Error processing ${file.name}: ${(e as Error).message}`;
        console.error(msg, e);
        perFileErrors.push(msg);
      } finally {
        console.timeEnd(file.name);
      }

      results.push({ fileName: file.name, fileType, rowCount, status, errors: perFileErrors });
    }

    return NextResponse.json({ results }, { status: 200 });
  } catch (e) {
    console.error("[upload] top-level crash:", e);
    return NextResponse.json(
      { error: `Unexpected server error: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
