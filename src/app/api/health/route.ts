import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const startTime = Date.now();

export async function GET() {
  const timestamp = new Date().toISOString();
  const uptime = Math.floor((Date.now() - startTime) / 1000);

  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      db: "connected",
      timestamp,
      uptime,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "degraded",
        db: "error",
        error: error instanceof Error ? error.message : String(error),
        timestamp,
        uptime,
      },
      { status: 503 }
    );
  }
}
