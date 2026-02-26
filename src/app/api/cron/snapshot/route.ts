import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSnapshot } from "@/lib/sheets";

export async function GET(request: Request) {
  // Verify cron secret for Vercel cron jobs
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await createSnapshot(db );
    return NextResponse.json({
      success: true,
      created: result.created,
      unmatched: result.unmatched,
    });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

// Also support POST for manual trigger from the UI
export async function POST() {
  try {
    const result = await createSnapshot(db );
    return NextResponse.json({
      success: true,
      created: result.created,
      unmatched: result.unmatched,
    });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
