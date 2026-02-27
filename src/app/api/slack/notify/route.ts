import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendDailyDigest } from "@/lib/slack";

export async function POST(request: Request) {
  // Auth: require cron secret or skip if not set
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sendDailyDigest(db);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
