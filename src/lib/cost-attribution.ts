import type { PrismaClient } from "@prisma/client";
import { computeTicketDistribution } from "./linear-sync";

/**
 * Core cost attribution engine.
 *
 * Formula: attributed_cost(E, C, M) = sum(EngineerPayment(E, M)) * (tickets(E, C, M) / total_tickets(E, M))
 *
 * Recalculates EngineerCostAllocation for a given month by combining
 * actual bank payments (EngineerPayment) with Linear ticket distributions.
 */
export async function recalculateCostAttribution(db: PrismaClient, month: string) {
  // 1. Get ticket distributions from Linear
  const { distributions } = await computeTicketDistribution(month);

  // 2. Get total payment per engineer for this month
  const payments = await db.engineerPayment.findMany({
    where: { month },
  });
  const engineerPaymentTotals = new Map<string, number>();
  for (const p of payments) {
    engineerPaymentTotals.set(
      p.teamMemberId,
      (engineerPaymentTotals.get(p.teamMemberId) ?? 0) + p.amount
    );
  }

  // 3. Compute attributed costs
  const allocations: Array<{
    teamMemberId: string;
    customerId: string;
    month: string;
    ticketCount: number;
    totalTickets: number;
    percentage: number;
    attributedCost: number;
  }> = [];

  for (const dist of distributions) {
    const totalPayment = engineerPaymentTotals.get(dist.teamMemberId) ?? 0;
    // If no bank payment has posted yet, cost = $0 (no fallback per spec)
    const attributedCost = totalPayment * (dist.ticketCount / dist.totalTickets);

    allocations.push({
      teamMemberId: dist.teamMemberId,
      customerId: dist.customerId,
      month,
      ticketCount: dist.ticketCount,
      totalTickets: dist.totalTickets,
      percentage: dist.percentage,
      attributedCost,
    });
  }

  // 4. Upsert EngineerCostAllocation records
  for (const alloc of allocations) {
    await db.engineerCostAllocation.upsert({
      where: {
        teamMemberId_customerId_month: {
          teamMemberId: alloc.teamMemberId,
          customerId: alloc.customerId,
          month: alloc.month,
        },
      },
      create: alloc,
      update: {
        ticketCount: alloc.ticketCount,
        totalTickets: alloc.totalTickets,
        percentage: alloc.percentage,
        attributedCost: alloc.attributedCost,
      },
    });
  }

  // 5. Clean up allocations for engineer/customer combos that no longer exist
  const validKeys = new Set(allocations.map((a) => `${a.teamMemberId}:${a.customerId}`));
  const existing = await db.engineerCostAllocation.findMany({
    where: { month },
    select: { id: true, teamMemberId: true, customerId: true },
  });
  const toDelete = existing.filter(
    (e) => !validKeys.has(`${e.teamMemberId}:${e.customerId}`)
  );
  if (toDelete.length > 0) {
    await db.engineerCostAllocation.deleteMany({
      where: { id: { in: toDelete.map((d) => d.id) } },
    });
  }

  return allocations;
}
