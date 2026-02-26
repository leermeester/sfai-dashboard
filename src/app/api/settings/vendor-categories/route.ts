import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recalculateMonthlyCosts } from "@/lib/mercury";

export async function GET() {
  const rules = await db.vendorCategoryRule.findMany({
    orderBy: { vendorPattern: "asc" },
  });
  return NextResponse.json({ rules });
}

export async function PUT(request: Request) {
  const { rules } = await request.json();

  const existing = await db.vendorCategoryRule.findMany({ select: { id: true } });
  const existingIds = new Set(existing.map((r) => r.id));
  const incomingIds = new Set(
    rules
      .filter((r: { id: string }) => !r.id.startsWith("new-"))
      .map((r: { id: string }) => r.id)
  );

  // Delete removed rules
  for (const id of existingIds) {
    if (!incomingIds.has(id)) {
      await db.vendorCategoryRule.delete({ where: { id } });
    }
  }

  // Upsert rules
  const result = [];
  for (const rule of rules) {
    const data = {
      vendorPattern: rule.vendorPattern,
      category: rule.category,
      displayName: rule.displayName || null,
    };

    if (rule.id.startsWith("new-")) {
      const created = await db.vendorCategoryRule.create({ data });
      result.push(created);
    } else {
      const updated = await db.vendorCategoryRule.update({
        where: { id: rule.id },
        data,
      });
      result.push(updated);
    }
  }

  // Re-categorize uncategorized outgoing transactions with the new rules
  const uncategorized = await db.bankTransaction.findMany({
    where: { direction: "outgoing", costCategory: null },
  });

  for (const txn of uncategorized) {
    const counterparty = txn.counterpartyName?.toLowerCase() ?? "";
    for (const rule of result) {
      if (counterparty.includes(rule.vendorPattern.toLowerCase())) {
        await db.bankTransaction.update({
          where: { id: txn.id },
          data: { costCategory: rule.category },
        });
        break;
      }
    }
  }

  // Recalculate monthly cost summaries
  await recalculateMonthlyCosts(db);

  return NextResponse.json({ rules: result });
}
