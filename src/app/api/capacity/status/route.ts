import { NextResponse } from "next/server";
import { computeCapacityStatus, getCurrentWeekStart } from "@/lib/capacity";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const weekStart = getCurrentWeekStart();
    const status = await computeCapacityStatus(weekStart);
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
