import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recalculateMargins } from "@/lib/margins";
import { validateBody, allocationsPayloadSchema } from "@/lib/validations";

export async function PUT(request: Request) {
  const body = await request.json();
  const parsed = validateBody(allocationsPayloadSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { month, allocations } = parsed.data;

  await db.timeAllocation.deleteMany({ where: { month } });

  for (const alloc of allocations) {
    await db.timeAllocation.create({
      data: {
        teamMemberId: alloc.teamMemberId,
        customerId: alloc.customerId,
        month,
        week: alloc.week,
        percentage: alloc.percentage,
        source: alloc.source ?? "manual",
      },
    });
  }

  await recalculateMargins(db, month);

  return NextResponse.json({ success: true });
}
