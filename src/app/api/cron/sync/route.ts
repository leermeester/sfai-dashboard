import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncTransactions, recalculateMonthlyCosts } from "@/lib/mercury";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncTransactions(db);
    await recalculateMonthlyCosts(db);
    return NextResponse.json({
      success: true,
      synced: result.synced,
      reconciled: result.reconciled,
    });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
