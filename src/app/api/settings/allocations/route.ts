import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(request: Request) {
  const { month, allocations } = await request.json();

  // Delete existing allocations for this month
  await db.timeAllocation.deleteMany({ where: { month } });

  // Create new allocations
  for (const alloc of allocations) {
    await db.timeAllocation.create({
      data: {
        teamMemberId: alloc.teamMemberId,
        customerId: alloc.customerId,
        month,
        percentage: alloc.percentage,
      },
    });
  }

  // Recalculate margins for this month
  await recalculateMargins(month);

  return NextResponse.json({ success: true });
}

async function recalculateMargins(month: string) {
  const allocations = await db.timeAllocation.findMany({
    where: { month },
    include: { teamMember: true, customer: true },
  });

  // Group allocations by customer
  const customerCosts = new Map<string, number>();
  for (const alloc of allocations) {
    const cost =
      ((alloc.teamMember.monthlyCost ?? 0) * alloc.percentage) / 100;
    customerCosts.set(
      alloc.customerId,
      (customerCosts.get(alloc.customerId) ?? 0) + cost
    );
  }

  // Get revenue from latest snapshots or confirmed payments
  const customers = await db.customer.findMany({ where: { isActive: true } });

  for (const customer of customers) {
    const engineeringCost = customerCosts.get(customer.id) ?? 0;

    // Try confirmed payments first
    const confirmedTxns = await db.bankTransaction.findMany({
      where: {
        customerId: customer.id,
        isReconciled: true,
        reconciledMonth: month,
      },
    });
    let revenue = confirmedTxns.reduce((sum, t) => sum + t.amount, 0);

    // Fall back to latest snapshot if no confirmed payment
    if (revenue === 0) {
      const snapshot = await db.salesSnapshot.findFirst({
        where: { customerId: customer.id, month },
        orderBy: { snapshotDate: "desc" },
      });
      revenue = snapshot?.amount ?? 0;
    }

    if (revenue > 0 || engineeringCost > 0) {
      const margin = revenue - engineeringCost;
      const marginPercent = revenue > 0 ? (margin / revenue) * 100 : 0;

      await db.monthlyMargin.upsert({
        where: {
          customerId_month: { customerId: customer.id, month },
        },
        create: {
          customerId: customer.id,
          month,
          revenue,
          engineeringCost,
          margin,
          marginPercent,
        },
        update: {
          revenue,
          engineeringCost,
          margin,
          marginPercent,
        },
      });
    }
  }
}
