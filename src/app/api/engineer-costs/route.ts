import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  if (!month) {
    return NextResponse.json({ error: "month parameter required" }, { status: 400 });
  }

  // Cost matrix: all EngineerCostAllocation records for the month
  const allocations = await db.engineerCostAllocation.findMany({
    where: { month },
    include: {
      teamMember: { select: { id: true, name: true } },
      customer: { select: { id: true, displayName: true } },
    },
  });

  // Engineer payments for the month (for showing total payment per engineer)
  const payments = await db.engineerPayment.findMany({
    where: { month },
    include: {
      teamMember: { select: { id: true, name: true } },
      bankTransaction: {
        select: { counterpartyName: true, amount: true, postedAt: true },
      },
    },
  });

  return NextResponse.json({ allocations, payments, month });
}
