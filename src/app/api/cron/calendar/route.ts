import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncMeetings } from "@/lib/calendar";
import { createLogger } from "@/lib/logger";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || (process.env.NODE_ENV !== "production" ? "dev-secret-change-me" : "");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logger = createLogger();

  try {
    const result = await syncMeetings(db, logger);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    logger.error("Calendar sync failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_CHANNEL_ID) {
      try {
        const { sendErrorAlert } = await import("@/lib/slack");
        await sendErrorAlert(error instanceof Error ? error : new Error(String(error)), {
          sync: "calendar",
          correlationId: logger.correlationId,
        });
      } catch {
        // Don't mask original error
      }
    }

    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
