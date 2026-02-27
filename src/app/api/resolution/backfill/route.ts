import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { matchCustomer } from "@/lib/matching";
import { createResolutionItems, type ResolutionItemInput } from "@/lib/resolution-queue";

/**
 * POST /api/resolution/backfill
 * Scans existing unmatched incoming transactions and creates resolution items.
 * This is a one-time catch-up for data that predates the resolution queue.
 */
export async function POST() {
  const customers = await db.customer.findMany({
    where: { isActive: true },
    select: {
      id: true,
      displayName: true,
      spreadsheetName: true,
      bankName: true,
      emailDomain: true,
      aliases: true,
    },
  });

  const resolutionItems: ResolutionItemInput[] = [];

  // Unmatched incoming bank transactions (no customerId)
  const unmatchedIncoming = await db.bankTransaction.findMany({
    where: { direction: "incoming", isReconciled: false, counterpartyName: { not: null } },
    select: { counterpartyName: true, amount: true, postedAt: true },
    distinct: ["counterpartyName"],
  });

  for (const txn of unmatchedIncoming) {
    if (!txn.counterpartyName) continue;
    const matches = matchCustomer(txn.counterpartyName, customers);
    const best = matches[0];
    resolutionItems.push({
      type: "customer_match",
      sourceEntity: txn.counterpartyName,
      suggestedMatch: best
        ? { id: best.id, label: best.label, confidence: best.confidence, matchedOn: best.matchedOn }
        : undefined,
      confidence: best?.confidence ?? 0,
      context: { amount: txn.amount, postedAt: txn.postedAt?.toISOString() },
    });
  }

  const result = await createResolutionItems(db, resolutionItems);

  return NextResponse.json({
    scanned: {
      unmatchedIncoming: unmatchedIncoming.length,
    },
    resolution: result,
  });
}
