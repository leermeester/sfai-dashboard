import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveItem, type ResolutionChannel, type ResolveDecision } from "@/lib/resolution-queue";
import { recalculateMarginsForMonths } from "@/lib/margins";
import { validateBody, resolveDecisionSchema } from "@/lib/validations";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = validateBody(resolveDecisionSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const decision: ResolveDecision = {
      action: parsed.data.action,
      customerId: parsed.data.customerId,
      bankName: parsed.data.bankName,
      engineerSplits: parsed.data.engineerSplits,
    };
    const channel = (parsed.data.channel || "dashboard") as ResolutionChannel;

    // Get item type before resolving (for post-resolution recalc)
    const item = await db.resolutionItem.findUnique({ where: { id } });
    const result = await resolveItem(db, id, decision, channel);

    // Trigger margin recalculation for revenue-affecting resolutions
    if (result.resolved && item && (decision.action === "approve" || decision.action === "manual")) {
      if (item.type === "customer_match" && decision.customerId) {
        const affectedTxns = await db.bankTransaction.findMany({
          where: { customerId: decision.customerId, isReconciled: true },
          select: { reconciledMonth: true },
        });
        const months = affectedTxns
          .map((t) => t.reconciledMonth)
          .filter((m): m is string => !!m);
        if (months.length > 0) {
          await recalculateMarginsForMonths(db, months);
        }
      }

      if (item.type === "engineer_split") {
        const context = item.context ? JSON.parse(item.context) : {};
        const txnIds: string[] = context.transactionIds ?? [];
        if (txnIds.length > 0) {
          const txns = await db.bankTransaction.findMany({
            where: { id: { in: txnIds } },
            select: { postedAt: true },
          });
          const months = txns
            .filter((t) => t.postedAt)
            .map((t) => {
              const d = new Date(t.postedAt!);
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            });
          if (months.length > 0) {
            await recalculateMarginsForMonths(db, [...new Set(months)]);
          }
        }
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("not found") ? 404 : message.includes("already resolved") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
