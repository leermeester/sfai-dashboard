import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentWeekStart } from "@/lib/capacity";
import { subWeeks } from "date-fns";

/**
 * Weekly forecast rollover — runs every Monday at 00:00 UTC.
 *
 * Cleans up forecasts from 2+ weeks ago to prevent stale data
 * accumulation. Current and next week's forecasts are preserved.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentWeek = getCurrentWeekStart();
  const twoWeeksAgo = subWeeks(currentWeek, 2);

  try {
    // Delete forecasts older than 2 weeks
    const deleted = await db.demandForecast.deleteMany({
      where: { weekStart: { lt: twoWeeksAgo } },
    });

    return NextResponse.json({
      success: true,
      currentWeek: currentWeek.toISOString(),
      deletedOldForecasts: deleted.count,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
