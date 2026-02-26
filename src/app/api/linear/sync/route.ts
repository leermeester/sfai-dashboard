import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncLinearAllocations } from "@/lib/linear-sync";

export async function POST(request: Request) {
  const { month, forceRefresh } = await request.json();

  try {
    const result = await syncLinearAllocations(
      month,
      forceRefresh ?? false
    );
    return NextResponse.json({
      success: true,
      count: result.allocations.length,
      issueCount: result.issueCount,
      unmappedCount: result.unmappedCount,
    });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  if (!month) {
    return NextResponse.json(
      { error: "month parameter required" },
      { status: 400 }
    );
  }

  const cached = await db.linearSyncCache.findUnique({
    where: { month },
  });
  return NextResponse.json({
    synced: !!cached,
    syncedAt: cached?.syncedAt ?? null,
  });
}
