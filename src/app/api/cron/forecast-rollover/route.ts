import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMonth } from "@/lib/utils";

/**
 * Weekly forecast rollover — runs every Monday at 00:00 UTC.
 *
 * 1. Delete old "this_week" forecasts for the current month.
 * 2. Rename "next_week" forecasts to "this_week".
 *
 * If no "next_week" forecasts exist the new week starts with the
 * same values that were in "this_week" (they were never deleted
 * because step 2 would have produced them). The chart already
 * inherits this_week data for next_week when next_week is empty,
 * so no extra copy is needed.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const month = getCurrentMonth();

  try {
    // Count before for logging
    const nextWeekCount = await db.demandForecast.count({
      where: { month, forecastType: "next_week" },
    });

    // 1. Delete current "this_week" forecasts
    const deleted = await db.demandForecast.deleteMany({
      where: { month, forecastType: "this_week" },
    });

    // 2. Promote "next_week" → "this_week"
    const promoted = await db.demandForecast.updateMany({
      where: { month, forecastType: "next_week" },
      data: { forecastType: "this_week" },
    });

    return NextResponse.json({
      success: true,
      month,
      deletedThisWeek: deleted.count,
      promotedNextWeek: promoted.count,
      note:
        nextWeekCount === 0
          ? "No next_week forecasts existed — this_week values carry forward unchanged."
          : undefined,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
