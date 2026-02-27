import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSnapshot } from "@/lib/sheets";
import { createLogger } from "@/lib/logger";

function verifyCron(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || (process.env.NODE_ENV !== "production" ? "dev-secret-change-me" : "");
  return !!(cronSecret && authHeader === `Bearer ${cronSecret}`);
}

export async function GET(request: Request) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logger = createLogger();

  try {
    const result = await createSnapshot(db, logger);
    return NextResponse.json({
      success: true,
      created: result.created,
      unmatched: result.unmatched,
    });
  } catch (error) {
    logger.error("Snapshot creation failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_CHANNEL_ID) {
      try {
        const { sendErrorAlert } = await import("@/lib/slack");
        await sendErrorAlert(error instanceof Error ? error : new Error(String(error)), {
          sync: "snapshot",
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

export async function POST(request: Request) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logger = createLogger();

  try {
    const result = await createSnapshot(db, logger);
    return NextResponse.json({
      success: true,
      created: result.created,
      unmatched: result.unmatched,
    });
  } catch (error) {
    logger.error("Snapshot creation failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
