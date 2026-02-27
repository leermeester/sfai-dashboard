import type { PrismaClient } from "@prisma/client";
import { recalculateCostAttribution } from "./cost-attribution";

/**
 * Recalculate monthly margins for a given month.
 * Uses EngineerCostAllocation (bank payments × ticket distribution) for engineering costs
 * and bank transactions / snapshots for revenue.
 */
export async function recalculateMargins(db: PrismaClient, month: string) {
  // Recalculate cost attributions from bank payments + Linear tickets
  await recalculateCostAttribution(db, month);

  // Sum attributed costs per customer
  const costAllocations = await db.engineerCostAllocation.findMany({
    where: { month },
  });
  const customerCosts = new Map<string, number>();
  for (const alloc of costAllocations) {
    customerCosts.set(
      alloc.customerId,
      (customerCosts.get(alloc.customerId) ?? 0) + alloc.attributedCost
    );
  }

  const customers = await db.customer.findMany({ where: { isActive: true } });

  for (const customer of customers) {
    const engineeringCost = customerCosts.get(customer.id) ?? 0;

    const confirmedTxns = await db.bankTransaction.findMany({
      where: {
        customerId: customer.id,
        isReconciled: true,
        reconciledMonth: month,
      },
    });
    let revenue = confirmedTxns.reduce((sum, t) => sum + t.amount, 0);

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

/**
 * Recalculate margins for multiple months (e.g., after a resolution that affects several transactions).
 */
export async function recalculateMarginsForMonths(db: PrismaClient, months: string[]) {
  const uniqueMonths = [...new Set(months)];
  for (const month of uniqueMonths) {
    await recalculateMargins(db, month);
  }
}
