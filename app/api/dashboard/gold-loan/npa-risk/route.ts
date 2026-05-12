import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveSnapshot } from "@/lib/snapshotQuery";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const snap = await resolveSnapshot("supra", searchParams);

    if (!snap) return NextResponse.json({ npa: null });

    const branchNPA = (snap.branchNPA ?? []) as { branch: string; gnpaAmount: number; gnpaPct: number }[];

    return NextResponse.json({
      npa: {
        gnpaAmount:   snap.gnpaAmount,
        gnpaPct:      snap.gnpaPct,
        // nnpaPct is approximated as gnpaPct × 0.65 (hardcoded until provisions data available)
        nnpaPct:      snap.nnpaPct,
        auctionCases: snap.auctionCases,
        // SMA buckets — DPD ranges per RBI standard:
        //   SMA-0: DPD 1–30, SMA-1: DPD 31–60, SMA-2: DPD 61–90
        // Values = outstanding balance (closingBalance) in each bucket.
        // Note: DPD values in the file are as of the upload date. If the file
        // is stale, these figures will be understated.
        sma0: snap.bucket0to30,
        sma1: snap.bucket31to60,
        sma2: snap.bucket61to90,
        npa:  snap.bucket90plus,
        branchNPA,
        // Metadata for transparency
        dataNote: "DPD-based classification. Ensure uploaded file has current-date DPD values for accuracy.",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
