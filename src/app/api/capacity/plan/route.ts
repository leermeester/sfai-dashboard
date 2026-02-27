import { NextResponse } from "next/server";
import { computeCapacityPlan } from "@/lib/capacity";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const plan = await computeCapacityPlan();
    return NextResponse.json(plan);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
