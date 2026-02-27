import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncTransactions, recalculateMonthlyCosts, matchLaborTransactionsToEngineers } from "@/lib/mercury";
import { createLogger } from "@/lib/logger";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || (process.env.NODE_ENV !== "production" ? "dev-secret-change-me" : "");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logger = createLogger();

  try {
    const result = await syncTransactions(db, logger);
    await recalculateMonthlyCosts(db);

    // Match labor transactions to engineers and recalculate cost attribution
    const engineerMatch = await matchLaborTransactionsToEngineers(db, logger);

    // Recalculate margins for current and previous months
    const { recalculateMarginsForMonths } = await import("@/lib/margins");
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
    await recalculateMarginsForMonths(db, [currentMonth, prevMonth]);

    // Send Slack notification if configured
    let slackResult = null;
    if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_CHANNEL_ID) {
      try {
        const { sendDailyDigest } = await import("@/lib/slack");
        slackResult = await sendDailyDigest(db);
      } catch {
        // Slack notification is optional, don't fail the sync
      }
    }

    return NextResponse.json({
      success: true,
      synced: result.synced,
      reconciled: result.reconciled,
      resolution: result.resolution,
      engineerMatch,
      slack: slackResult,
    });
  } catch (error) {
    logger.error("Mercury sync failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    // Send Slack error alert if configured
    if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_CHANNEL_ID) {
      try {
        const { sendErrorAlert } = await import("@/lib/slack");
        await sendErrorAlert(error instanceof Error ? error : new Error(String(error)), {
          sync: "mercury",
          correlationId: logger.correlationId,
        });
      } catch {
        // Don't mask original error with Slack failure
      }
    }

    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
