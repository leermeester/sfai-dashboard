import { NextRequest, NextResponse } from "next/server";
import { computeFounderPortfolio } from "@/lib/founder-capacity";
import { getCurrentMonth } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const month =
    request.nextUrl.searchParams.get("month") ?? getCurrentMonth();

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: "month must be in YYYY-MM format" },
      { status: 400 }
    );
  }

  const data = await computeFounderPortfolio(month);
  return NextResponse.json(data);
}
