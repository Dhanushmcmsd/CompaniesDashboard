import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseGoldLoanExcel } from "@/lib/gold-loan/excel-parser";
import { calculateKPIs, calculateKPIsFromTransaction } from "@/lib/gold-loan/calculator";

// ---------------------------------------------------------------------------
// Helpers: raw-SQL snapshot writes
// ---------------------------------------------------------------------------
// Prisma's generated client validates ALL columns in the schema at runtime,
// including overdueAccountNumbers, even when you don't include it in data:{}.
// Until `npx prisma migrate deploy` has been run on the live DB (adding the
// column), every prisma.goldLoanSnapshot.create/update/upsert call will crash
// with P2022 "column does not exist".
//
// Fix: detect whether the column exists once per request, then use either the
// normal Prisma ORM path (column present) or raw SQL (column absent).
// ---------------------------------------------------------------------------

async function columnExists(): Promise<boolean> {
  try {
    const rows = await prisma.$queryRawUnsafe<{ column_name: string }[]>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'gold_loan_snapshots'
        AND column_name = 'overdueAccountNumbers'
      LIMIT 1
    `);
    return rows.length > 0;
  } catch {
    return false;
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

    // Check once whether the migration column exists in the live DB
    const hasOverdueCol = await columnExists();
    if (!hasOverdueCol) {
      console.warn(
        "[upload] overdueAccountNumbers column missing in DB. " +
          "Run `npx prisma migrate deploy` to enable full overdue cross-referencing."
      );
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
        // ── 1. Parse Excel ────────────────────────────────────────────────
        const buffer = await file.arrayBuffer();
        const parsed = parseGoldLoanExcel(buffer, file.name);
        fileType = parsed.fileType;
        rowCount = parsed.rowCount;
        perFileErrors.push(...parsed.errors);

        console.log(`[upload] ${file.name} → type=${fileType} rows=${rowCount}`);

        // ── 2. Upload batch record ────────────────────────────────────────
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
          // ── 3a. Balance sheet ─────────────────────────────────────────
          const kpis = calculateKPIs(parsed.rows);
          const overdueAccountNumbers = parsed.overdueAccountNumbers;

          if (hasOverdueCol) {
            // Full Prisma ORM path — column exists
            await prisma.goldLoanSnapshot.upsert({
              where: { uploadBatchId: batch.id },
              create: {
                uploadBatchId: batch.id,
                company: "supra",
                reportDate: parsed.reportDate,
                totalAUM: kpis.totalAUM,
                totalAccounts: kpis.totalAccounts,
                totalCustomers: kpis.totalCustomers,
                avgTicketSize: kpis.avgTicketSize,
                avgYield: kpis.avgYield,
                totalGoldWeight: kpis.totalGoldWeight,
                avgGoldWeightPerLoan: kpis.avgGoldWeightPerLoan,
                avgLTV: kpis.avgLTV,
                avgPresentRate: kpis.avgPresentRate,
                avgGoldValuePerLoan: kpis.avgGoldValuePerLoan,
                newDisbursements: kpis.newDisbursements,
                mtdDisbursements: kpis.mtdDisbursements,
                ytdDisbursements: kpis.ytdDisbursements,
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
                branchAUM: kpis.branchAUM,
                productAUM: kpis.productAUM,
                branchDisbursement: kpis.branchDisbursement,
                branchNPA: kpis.branchNPA,
                branchGoldWeight: kpis.branchGoldWeight,
                highLTVAccounts: kpis.highLTVAccounts,
                goldValueMismatch: kpis.goldValueMismatch,
                auctionCases: kpis.auctionCases,
                overdueAccountNumbers,
              },
              update: {
                reportDate: parsed.reportDate,
                totalAUM: kpis.totalAUM,
                totalAccounts: kpis.totalAccounts,
                totalCustomers: kpis.totalCustomers,
                avgTicketSize: kpis.avgTicketSize,
                avgYield: kpis.avgYield,
                totalGoldWeight: kpis.totalGoldWeight,
                avgGoldWeightPerLoan: kpis.avgGoldWeightPerLoan,
                avgLTV: kpis.avgLTV,
                avgPresentRate: kpis.avgPresentRate,
                avgGoldValuePerLoan: kpis.avgGoldValuePerLoan,
                newDisbursements: kpis.newDisbursements,
                mtdDisbursements: kpis.mtdDisbursements,
                ytdDisbursements: kpis.ytdDisbursements,
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
                branchAUM: kpis.branchAUM,
                productAUM: kpis.productAUM,
                branchDisbursement: kpis.branchDisbursement,
                branchNPA: kpis.branchNPA,
                branchGoldWeight: kpis.branchGoldWeight,
                highLTVAccounts: kpis.highLTVAccounts,
                goldValueMismatch: kpis.goldValueMismatch,
                auctionCases: kpis.auctionCases,
                overdueAccountNumbers,
              },
            });
          } else {
            // Raw SQL path — column doesn't exist yet, exclude it
            perFileErrors.push(
              "DB migration pending: overdueAccountNumbers not stored. " +
                "Run `npx prisma migrate deploy`, then re-upload to enable overdue cross-referencing."
            );
            await prisma.$executeRawUnsafe(
              `INSERT INTO gold_loan_snapshots (
                id, "uploadBatchId", company, "reportDate", "snapshotDate",
                "totalAUM", "totalAccounts", "totalCustomers", "avgTicketSize", "avgYield",
                "totalGoldWeight", "avgGoldWeightPerLoan", "avgLTV", "avgPresentRate", "avgGoldValuePerLoan",
                "newDisbursements", "mtdDisbursements", "ytdDisbursements",
                "gnpaAmount", "gnpaPct", "nnpaPct",
                "totalOverdue", "overdueCollection", "collectionEfficiency", "overduePercent",
                "bucket0to30", "bucket31to60", "bucket61to90", "bucket90plus",
                "branchAUM", "productAUM", "branchDisbursement", "branchNPA", "branchGoldWeight",
                "highLTVAccounts", "goldValueMismatch", "auctionCases",
                "createdAt"
              ) VALUES (
                gen_random_uuid(), $1, $2, $3, NOW(),
                $4, $5, $6, $7, $8,
                $9, $10, $11, $12, $13,
                $14, $15, $16,
                $17, $18, $19,
                $20, $21, $22, $23,
                $24, $25, $26, $27,
                $28, $29, $30, $31, $32,
                $33, $34, $35,
                NOW()
              )
              ON CONFLICT ("uploadBatchId") DO UPDATE SET
                "reportDate" = EXCLUDED."reportDate",
                "totalAUM" = EXCLUDED."totalAUM",
                "totalAccounts" = EXCLUDED."totalAccounts",
                "totalCustomers" = EXCLUDED."totalCustomers",
                "avgTicketSize" = EXCLUDED."avgTicketSize",
                "avgYield" = EXCLUDED."avgYield",
                "totalGoldWeight" = EXCLUDED."totalGoldWeight",
                "avgGoldWeightPerLoan" = EXCLUDED."avgGoldWeightPerLoan",
                "avgLTV" = EXCLUDED."avgLTV",
                "avgPresentRate" = EXCLUDED."avgPresentRate",
                "avgGoldValuePerLoan" = EXCLUDED."avgGoldValuePerLoan",
                "newDisbursements" = EXCLUDED."newDisbursements",
                "mtdDisbursements" = EXCLUDED."mtdDisbursements",
                "ytdDisbursements" = EXCLUDED."ytdDisbursements",
                "gnpaAmount" = EXCLUDED."gnpaAmount",
                "gnpaPct" = EXCLUDED."gnpaPct",
                "nnpaPct" = EXCLUDED."nnpaPct",
                "totalOverdue" = EXCLUDED."totalOverdue",
                "overdueCollection" = EXCLUDED."overdueCollection",
                "collectionEfficiency" = EXCLUDED."collectionEfficiency",
                "overduePercent" = EXCLUDED."overduePercent",
                "bucket0to30" = EXCLUDED."bucket0to30",
                "bucket31to60" = EXCLUDED."bucket31to60",
                "bucket61to90" = EXCLUDED."bucket61to90",
                "bucket90plus" = EXCLUDED."bucket90plus",
                "branchAUM" = EXCLUDED."branchAUM",
                "productAUM" = EXCLUDED."productAUM",
                "branchDisbursement" = EXCLUDED."branchDisbursement",
                "branchNPA" = EXCLUDED."branchNPA",
                "branchGoldWeight" = EXCLUDED."branchGoldWeight",
                "highLTVAccounts" = EXCLUDED."highLTVAccounts",
                "goldValueMismatch" = EXCLUDED."goldValueMismatch",
                "auctionCases" = EXCLUDED."auctionCases"`,
              batch.id,
              "supra",
              parsed.reportDate,
              kpis.totalAUM, kpis.totalAccounts, kpis.totalCustomers, kpis.avgTicketSize, kpis.avgYield,
              kpis.totalGoldWeight, kpis.avgGoldWeightPerLoan, kpis.avgLTV, kpis.avgPresentRate, kpis.avgGoldValuePerLoan,
              kpis.newDisbursements, kpis.mtdDisbursements, kpis.ytdDisbursements,
              kpis.gnpaAmount, kpis.gnpaPct, kpis.nnpaPct,
              kpis.totalOverdue, kpis.overdueCollection, kpis.collectionEfficiency, kpis.overduePercent,
              kpis.bucket0to30, kpis.bucket31to60, kpis.bucket61to90, kpis.bucket90plus,
              JSON.stringify(kpis.branchAUM),
              JSON.stringify(kpis.productAUM),
              JSON.stringify(kpis.branchDisbursement),
              JSON.stringify(kpis.branchNPA),
              JSON.stringify(kpis.branchGoldWeight),
              kpis.highLTVAccounts, kpis.goldValueMismatch, kpis.auctionCases
            );
          }

          await prisma.uploadBatch.update({
            where: { id: batch.id },
            data: { status: "done", errors: perFileErrors },
          });
          console.log(`[upload] ${file.name} → balance KPI snapshot saved`);
          status = "done";
        } else if (fileType === "transaction") {
          // ── 3b. Transaction statement ─────────────────────────────────
          // Fetch latest snapshot — selecting overdueAccountNumbers only if
          // the column already exists (avoids P2022 crash).
          let latestSnapshot: {
            id: string;
            totalOverdue: number;
            overdueAccountNumbers?: unknown;
          } | null = null;

          if (hasOverdueCol) {
            latestSnapshot = await prisma.goldLoanSnapshot.findFirst({
              where: { company: "supra" },
              orderBy: { snapshotDate: "desc" },
              select: { id: true, totalOverdue: true, overdueAccountNumbers: true },
            });
          } else {
            perFileErrors.push(
              "DB migration pending: overdueAccountNumbers column missing. " +
                "Run `npx prisma migrate deploy`, then re-upload the balance sheet " +
                "to enable accurate overdue collection cross-referencing."
            );
            const basic = await prisma.goldLoanSnapshot.findFirst({
              where: { company: "supra" },
              orderBy: { snapshotDate: "desc" },
              select: { id: true, totalOverdue: true },
            });
            latestSnapshot = basic ? { ...basic, overdueAccountNumbers: null } : null;
          }

          const storedOverdue = latestSnapshot?.overdueAccountNumbers;
          const overdueArr: string[] = Array.isArray(storedOverdue)
            ? (storedOverdue as string[])
            : [];
          const overdueSet = new Set<string>(overdueArr);

          const txnKPIs = calculateKPIsFromTransaction(parsed.rows, overdueSet);

          console.log(
            `[upload] ${file.name} → txn KPIs:`,
            `disbursed=${txnKPIs.totalDisbursed.toFixed(2)}`,
            `collected=${txnKPIs.totalCollected.toFixed(2)}`,
            `overdueCollection=${txnKPIs.overdueCollectionFromTxn.toFixed(2)}`,
            `branches=${txnKPIs.branchDisbursementFromTxn.length}`
          );

          if (latestSnapshot) {
            const totalOverdue = latestSnapshot.totalOverdue;
            const newODCollection = txnKPIs.overdueCollectionFromTxn;
            const newEfficiency =
              totalOverdue > 0 ? (newODCollection / totalOverdue) * 100 : 0;

            // Use calculateTransactionKPIs for full disbursement breakdown (FTD/MTD/YTD)
            // We need to import it to get the period-filtered amounts
            const { calculateTransactionKPIs: calcTxnKPIs } = await import('@/lib/gold-loan/transaction-calculator');
            const fullTxnKPIs = calcTxnKPIs(parsed.rows, [], totalOverdue);

            // Build branch disbursement in the format matching BranchDisb type
            const branchDisbForSnapshot = fullTxnKPIs.branchDisbursements.map((b) => ({
              branch: b.branch,
              ftd: b.ftd,
              mtd: b.mtd,
              ytd: b.ytd,
            }));

            // Always use raw SQL for this patch so we never touch overdueAccountNumbers
            await prisma.$executeRawUnsafe(
              `UPDATE gold_loan_snapshots
               SET "overdueCollection" = $1,
                   "collectionEfficiency" = $2,
                   "branchDisbursement" = $3::jsonb,
                   "newDisbursements" = $4,
                   "mtdDisbursements" = $5,
                   "ytdDisbursements" = $6
               WHERE id = $7`,
              newODCollection,
              newEfficiency,
              JSON.stringify(branchDisbForSnapshot),
              fullTxnKPIs.ftdDisbursement,
              fullTxnKPIs.mtdDisbursement,
              fullTxnKPIs.ytdDisbursement,
              latestSnapshot.id
            );

            console.log(
              `[upload] Patched snapshot ${latestSnapshot.id}:`,
              `collectionEfficiency=${newEfficiency.toFixed(2)}%`,
              `ftdDisb=${fullTxnKPIs.ftdDisbursement.toFixed(2)}`,
              `mtdDisb=${fullTxnKPIs.mtdDisbursement.toFixed(2)}`,
              `ytdDisb=${fullTxnKPIs.ytdDisbursement.toFixed(2)}`
            );
          } else {
            perFileErrors.push(
              "No balance-sheet snapshot found for this company. " +
                "Upload the Loan Balance Statement first so overdue accounts can be " +
                "cross-referenced. Transaction KPIs calculated in memory but NOT stored."
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
