import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateBody, monthlyAllocationPayloadSchema } from "@/lib/validations";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Default to next month
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const defaultMonth = nextMonth.toISOString().slice(0, 7);
  const month = searchParams.get("month") || defaultMonth;

  const allocations = await db.monthlyAllocation.findMany({
    where: { month },
    include: {
      teamMember: { select: { name: true } },
      customer: { select: { displayName: true } },
    },
    orderBy: [{ teamMemberId: "asc" }, { weight: "desc" }],
  });

  return NextResponse.json({
    month,
    allocations: allocations.map((a) => ({
      id: a.id,
      teamMemberId: a.teamMemberId,
      teamMemberName: a.teamMember.name,
      customerId: a.customerId,
      customerName: a.customer.displayName,
      weight: a.weight,
    })),
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = validateBody(monthlyAllocationPayloadSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { month, allocations } = parsed.data;

  await db.$transaction(async (tx) => {
    await tx.monthlyAllocation.deleteMany({ where: { month } });
    for (const alloc of allocations) {
      await tx.monthlyAllocation.create({
        data: {
          teamMemberId: alloc.teamMemberId,
          customerId: alloc.customerId,
          month,
          weight: alloc.weight,
        },
      });
    }
  });

  return NextResponse.json({ success: true, count: allocations.length });
}
