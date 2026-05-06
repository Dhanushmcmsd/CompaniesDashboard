import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseGoldLoanExcel } from "@/lib/gold-loan/excel-parser";
import { calculateKPIs } from "@/lib/gold-loan/calculator";

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
      fileName: string
      fileType: string
      rowCount: number
      status: string
      errors: string[]
    }

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
            company:     "supra",
            portfolio:   "gold-loan",
            fileType,
            originalName: file.name,
            reportDate:  parsed.reportDate,
            uploadedBy:  session.user.email ?? "unknown",
            rowCount,
            status:      "pending",
          },
        });

        if (fileType === "unknown") {
          await prisma.uploadBatch.update({
            where: { id: batch.id },
            data:  { status: "error", errors: perFileErrors },
          });
          status = "error";
        } else if (fileType === "balance") {
          // ── 3. Calculate ALL KPIs in memory (no raw DB writes) ───────────
          const kpis = calculateKPIs(parsed.rows);

          // ── 4. Upsert a single KPI snapshot row ──────────────────────────
          await prisma.goldLoanSnapshot.upsert({
            where:  { uploadBatchId: batch.id },
            create: {
              uploadBatchId:        batch.id,
              company:              "supra",
              reportDate:           parsed.reportDate,
              totalAUM:             kpis.totalAUM,
              totalAccounts:        kpis.totalAccounts,
              totalCustomers:       kpis.totalCustomers,
              avgTicketSize:        kpis.avgTicketSize,
              avgYield:             kpis.avgYield,
              totalGoldWeight:      kpis.totalGoldWeight,
              avgGoldWeightPerLoan: kpis.avgGoldWeightPerLoan,
              avgLTV:               kpis.avgLTV,
              avgPresentRate:       kpis.avgPresentRate,
              avgGoldValuePerLoan:  kpis.avgGoldValuePerLoan,
              newDisbursements:     kpis.newDisbursements,
              mtdDisbursements:     kpis.mtdDisbursements,
              ytdDisbursements:     kpis.ytdDisbursements,
              gnpaAmount:           kpis.gnpaAmount,
              gnpaPct:              kpis.gnpaPct,
              nnpaPct:              kpis.nnpaPct,
              totalOverdue:         kpis.totalOverdue,
              overdueCollection:    kpis.overdueCollection,
              collectionEfficiency: kpis.collectionEfficiency,
              overduePercent:       kpis.overduePercent,
              bucket0to30:          kpis.bucket0to30,
              bucket31to60:         kpis.bucket31to60,
              bucket61to90:         kpis.bucket61to90,
              bucket90plus:         kpis.bucket90plus,
              branchAUM:            kpis.branchAUM,
              productAUM:           kpis.productAUM,
              branchDisbursement:   kpis.branchDisbursement,
              branchNPA:            kpis.branchNPA,
              branchGoldWeight:     kpis.branchGoldWeight,
              highLTVAccounts:      kpis.highLTVAccounts,
              goldValueMismatch:    kpis.goldValueMismatch,
              auctionCases:         kpis.auctionCases,
            },
            update: {
              reportDate:           parsed.reportDate,
              totalAUM:             kpis.totalAUM,
              totalAccounts:        kpis.totalAccounts,
              totalCustomers:       kpis.totalCustomers,
              avgTicketSize:        kpis.avgTicketSize,
              avgYield:             kpis.avgYield,
              totalGoldWeight:      kpis.totalGoldWeight,
              avgGoldWeightPerLoan: kpis.avgGoldWeightPerLoan,
              avgLTV:               kpis.avgLTV,
              avgPresentRate:       kpis.avgPresentRate,
              avgGoldValuePerLoan:  kpis.avgGoldValuePerLoan,
              newDisbursements:     kpis.newDisbursements,
              mtdDisbursements:     kpis.mtdDisbursements,
              ytdDisbursements:     kpis.ytdDisbursements,
              gnpaAmount:           kpis.gnpaAmount,
              gnpaPct:              kpis.gnpaPct,
              nnpaPct:              kpis.nnpaPct,
              totalOverdue:         kpis.totalOverdue,
              overdueCollection:    kpis.overdueCollection,
              collectionEfficiency: kpis.collectionEfficiency,
              overduePercent:       kpis.overduePercent,
              bucket0to30:          kpis.bucket0to30,
              bucket31to60:         kpis.bucket31to60,
              bucket61to90:         kpis.bucket61to90,
              bucket90plus:         kpis.bucket90plus,
              branchAUM:            kpis.branchAUM,
              productAUM:           kpis.productAUM,
              branchDisbursement:   kpis.branchDisbursement,
              branchNPA:            kpis.branchNPA,
              branchGoldWeight:     kpis.branchGoldWeight,
              highLTVAccounts:      kpis.highLTVAccounts,
              goldValueMismatch:    kpis.goldValueMismatch,
              auctionCases:         kpis.auctionCases,
            },
          });

          await prisma.uploadBatch.update({
            where: { id: batch.id },
            data:  { status: "done", errors: [] },
          });

          console.log(`[upload] ${file.name} → KPI snapshot saved for batch ${batch.id}`);
          status = "done";
        } else {
          // transaction / interest-extract files noted for future collection efficiency
          perFileErrors.push(
            `File type "${fileType}" received. Transaction/interest files will be used ` +
            `for collection efficiency in a future update. No data stored.`
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
