import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStats } from "@/lib/resolution-queue";

export async function GET() {
  try {
    const stats = await getStats(db);
    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
