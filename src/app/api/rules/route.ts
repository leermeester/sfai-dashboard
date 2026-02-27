import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const rules = await db.systemRule.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    rules: rules.map((r) => ({
      ...r,
      payload: JSON.parse(r.payload),
    })),
  });
}
