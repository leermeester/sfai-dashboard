import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncTransactions, recalculateMonthlyCosts } from "@/lib/mercury";

export async function POST() {
  try {
    const result = await syncTransactions(db);
    await recalculateMonthlyCosts(db);
    return NextResponse.json({
      success: true,
      syncedAt: new Date().toISOString(),
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
