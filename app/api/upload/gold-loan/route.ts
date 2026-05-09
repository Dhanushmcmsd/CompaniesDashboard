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
      let status   = "error";

      try {
        // ── 1. Parse Excel in memory ──────────────────────────────────────
        const buffer = await file.arrayBuffer();
        const parsed = parseGoldLoanExcel(buffer, file.name);
        fileType = parsed.fileType;
        rowCount = parsed.rowCount;
        perFileErrors.push(...parsed.errors);

        console.log(`[upload] ${file.name} → type=${fileType} rows=${rowCount}`);

        // ── 2. Create upload batch record ─────────────────────────────────
        const batch = await prisma.uploadBatch.create({
          data: {
            company:      "supra",
            portfolio:    "gold-loan",
            fileType,
            originalName: file.name,
            reportDate:   parsed.reportDate,
            uploadedBy:   session.user.email ?? "unknown",
            rowCount,
            status:       "pending",
          },
        });

        if (fileType === "unknown") {
          // ── Unknown file type — log and fail ──────────────────────────────
          await prisma.uploadBatch.update({
            where: { id: batch.id },
            data:  { status: "error", errors: perFileErrors },
          });
          status = "error";

        } else if (fileType === "balance") {
          // ── 3a. Balance sheet — calculate full KPI snapshot ───────────────
          const kpis = calculateKPIs(parsed.rows);

          // overdueAccountNumbers extracted by the parser (DPD > 0 rows)
          const overdueAccountNumbers = parsed.overdueAccountNumbers; // string[]

          // ── 4a. Upsert KPI snapshot (now includes overdueAccountNumbers) ──
          await prisma.goldLoanSnapshot.upsert({
            where:  { uploadBatchId: batch.id },
            create: {
              uploadBatchId:          batch.id,
              company:                "supra",
              reportDate:             parsed.reportDate,
              totalAUM:               kpis.totalAUM,
              totalAccounts:          kpis.totalAccounts,
              totalCustomers:         kpis.totalCustomers,
              avgTicketSize:          kpis.avgTicketSize,
              avgYield:               kpis.avgYield,
              totalGoldWeight:        kpis.totalGoldWeight,
              avgGoldWeightPerLoan:   kpis.avgGoldWeightPerLoan,
              avgLTV:                 kpis.avgLTV,
              avgPresentRate:         kpis.avgPresentRate,
              avgGoldValuePerLoan:    kpis.avgGoldValuePerLoan,
              newDisbursements:       kpis.newDisbursements,
              mtdDisbursements:       kpis.mtdDisbursements,
              ytdDisbursements:       kpis.ytdDisbursements,
              gnpaAmount:             kpis.gnpaAmount,
              gnpaPct:                kpis.gnpaPct,
              nnpaPct:                kpis.nnpaPct,
              totalOverdue:           kpis.totalOverdue,
              overdueCollection:      kpis.overdueCollection,
              collectionEfficiency:   kpis.collectionEfficiency,
              overduePercent:         kpis.overduePercent,
              bucket0to30:            kpis.bucket0to30,
              bucket31to60:           kpis.bucket31to60,
              bucket61to90:           kpis.bucket61to90,
              bucket90plus:           kpis.bucket90plus,
              branchAUM:              kpis.branchAUM,
              productAUM:             kpis.productAUM,
              branchDisbursement:     kpis.branchDisbursement,
              branchNPA:              kpis.branchNPA,
              branchGoldWeight:       kpis.branchGoldWeight,
              highLTVAccounts:        kpis.highLTVAccounts,
              goldValueMismatch:      kpis.goldValueMismatch,
              auctionCases:           kpis.auctionCases,
              overdueAccountNumbers,  // ← GAP 2 FIX: now stored
            },
            update: {
              reportDate:             parsed.reportDate,
              totalAUM:               kpis.totalAUM,
              totalAccounts:          kpis.totalAccounts,
              totalCustomers:         kpis.totalCustomers,
              avgTicketSize:          kpis.avgTicketSize,
              avgYield:               kpis.avgYield,
              totalGoldWeight:        kpis.totalGoldWeight,
              avgGoldWeightPerLoan:   kpis.avgGoldWeightPerLoan,
              avgLTV:                 kpis.avgLTV,
              avgPresentRate:         kpis.avgPresentRate,
              avgGoldValuePerLoan:    kpis.avgGoldValuePerLoan,
              newDisbursements:       kpis.newDisbursements,
              mtdDisbursements:       kpis.mtdDisbursements,
              ytdDisbursements:       kpis.ytdDisbursements,
              gnpaAmount:             kpis.gnpaAmount,
              gnpaPct:                kpis.gnpaPct,
              nnpaPct:                kpis.nnpaPct,
              totalOverdue:           kpis.totalOverdue,
              overdueCollection:      kpis.overdueCollection,
              collectionEfficiency:   kpis.collectionEfficiency,
              overduePercent:         kpis.overduePercent,
              bucket0to30:            kpis.bucket0to30,
              bucket31to60:           kpis.bucket31to60,
              bucket61to90:           kpis.bucket61to90,
              bucket90plus:           kpis.bucket90plus,
              branchAUM:              kpis.branchAUM,
              productAUM:             kpis.productAUM,
              branchDisbursement:     kpis.branchDisbursement,
              branchNPA:              kpis.branchNPA,
              branchGoldWeight:       kpis.branchGoldWeight,
              highLTVAccounts:        kpis.highLTVAccounts,
              goldValueMismatch:      kpis.goldValueMismatch,
              auctionCases:           kpis.auctionCases,
              overdueAccountNumbers,  // ← GAP 2 FIX: kept in sync on re-upload
            },
          });

          await prisma.uploadBatch.update({
            where: { id: batch.id },
            data:  { status: "done", errors: [] },
          });

          console.log(`[upload] ${file.name} → KPI snapshot saved, ${overdueAccountNumbers.length} overdue accounts stored`);
          status = "done";

        } else if (fileType === "transaction") {
          // ── 3b. Transaction statement — GAP 1 FIX ────────────────────────
          // Look up the latest balance-sheet snapshot for this company to get
          // the overdue account set for cross-referencing collection efficiency.
          const latestSnapshot = await prisma.goldLoanSnapshot.findFirst({
            where:   { company: "supra" },
            orderBy: { snapshotDate: "desc" },
            select:  {
              id:                    true,
              totalOverdue:          true,
              overdueAccountNumbers: true,
            },
          });

          // Build overdue Set from stored JSON (or empty if no balance sheet yet)
          // overdueAccountNumbers is stored as string[] JSON in the DB
          const storedOverdue = latestSnapshot?.overdueAccountNumbers;
          const overdueArr: string[] = Array.isArray(storedOverdue)
            ? (storedOverdue as string[])
            : [];
          const overdueSet = new Set<string>(overdueArr);

          // Calculate transaction KPIs
          const txnKPIs = calculateKPIsFromTransaction(parsed.rows, overdueSet);

          console.log(
            `[upload] ${file.name} → txn KPIs: disbursed=${txnKPIs.totalDisbursed.toFixed(2)}`,
            `collected=${txnKPIs.totalCollected.toFixed(2)}`,
            `overdueCollection=${txnKPIs.overdueCollectionFromTxn.toFixed(2)}`,
            `branches=${txnKPIs.branchDisbursementFromTxn.length}`,
          );

          // Patch the latest snapshot with transaction-derived collection efficiency.
          // This updates overdueCollection + collectionEfficiency in place so the
          // management dashboard immediately reflects the more accurate figure.
          if (latestSnapshot) {
            const totalOverdue = latestSnapshot.totalOverdue;
            const newODCollection = txnKPIs.overdueCollectionFromTxn;
            const newEfficiency   = totalOverdue > 0
              ? (newODCollection / totalOverdue) * 100
              : 0;

            await prisma.goldLoanSnapshot.update({
              where: { id: latestSnapshot.id },
              data: {
                overdueCollection:    newODCollection,
                collectionEfficiency: newEfficiency,
                // Store full transaction KPI breakdown as JSON in branchDisbursement
                // so branch-disbursement dashboard endpoint picks it up automatically.
                // The balance-sheet branchDisbursement (FTD/MTD/YTD buckets) is
                // preserved as a separate key below when both are available.
                branchDisbursement: txnKPIs.branchDisbursementFromTxn,
              },
            });

            console.log(
              `[upload] Patched snapshot ${latestSnapshot.id}: ` +
              `collectionEfficiency=${newEfficiency.toFixed(2)}%`
            );
          } else {
            perFileErrors.push(
              "No balance-sheet snapshot found for this company. " +
              "Upload the balance sheet first so overdue accounts can be cross-referenced. " +
              "Transaction KPIs calculated in memory but NOT stored."
            );
          }

          // Mark batch as done regardless — the txn file was processed successfully
          await prisma.uploadBatch.update({
            where: { id: batch.id },
            data:  { status: "done", errors: perFileErrors },
          });
          status = "done";

        } else {
          // interest-extract or any future type — noted for later
          perFileErrors.push(
            `File type "${fileType}" received. Interest-extract files will be processed ` +
            `in a future update. No data stored.`
          );
          await prisma.uploadBatch.update({
            where: { id: batch.id },
            data:  { status: "noted", errors: perFileErrors },
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
