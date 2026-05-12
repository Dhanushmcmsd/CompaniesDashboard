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

    if (!snap) return NextResponse.json({ highRisk: null, goldRate: 0, accounts: [] });

    return NextResponse.json({
      goldRate:         snap.avgPresentRate,
      // goldValueMismatch: accounts where closingBalance > (goldWeight × presentRate)
      // i.e. loan exceeds collateral value. Depends on accuracy of presentRate in upload.
      highRiskCount:    snap.goldValueMismatch,
      // highLTVAccounts: accounts where LTV > 85%
      highLTVCount:     snap.highLTVAccounts,
      // Row-level high-risk detail not stored in snapshot (counts only).
      // If presentRate in the uploaded file differs from live market rate, counts will differ.
      accounts: [],
      dataNote: "Counts based on Rate Per Gram column in uploaded file. Ensure this matches current market gold rate.",
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
