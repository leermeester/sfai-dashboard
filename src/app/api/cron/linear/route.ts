import { NextResponse } from "next/server";
import { syncLinearProjectIds } from "@/lib/linear-project-sync";
import { syncLinearAllocations } from "@/lib/linear-sync";
import { getCurrentMonth } from "@/lib/utils";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Sync Linear project IDs → customer records
    const projectSync = await syncLinearProjectIds();

    // 2. Sync allocations for current month (force refresh to bypass daily cache)
    const month = getCurrentMonth();
    const allocSync = await syncLinearAllocations(month, true);

    return NextResponse.json({
      success: true,
      projectSync: {
        matched: projectSync.matched,
        skipped: projectSync.skipped,
        unmatched: projectSync.unmatched,
      },
      allocationSync: {
        month,
        allocations: allocSync.allocations.length,
        issueCount: allocSync.issueCount,
        unmappedCount: allocSync.unmappedCount,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
