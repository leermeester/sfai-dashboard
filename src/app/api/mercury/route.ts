import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as mercury from "@/lib/mercury";
import { recalculateMargins } from "@/lib/margins";
import { validateBody, mercuryActionSchema } from "@/lib/validations";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  if (searchParams.get("test") === "true") {
    const connected = await mercury.testConnection();
    return NextResponse.json({ connected });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = validateBody(mercuryActionSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  if (parsed.data.action === "categorize") {
    const { txnId, costCategory } = parsed.data;
    const txn = await db.bankTransaction.findUnique({ where: { id: txnId } });
    if (!txn) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    await db.bankTransaction.update({
      where: { id: txnId },
      data: { costCategory },
    });

    // Recalculate monthly costs
    await mercury.recalculateMonthlyCosts(db);

    return NextResponse.json({ success: true, costsRecalculated: true });
  }

  if (parsed.data.action === "reconcile") {
    const { txnId, customerId } = parsed.data;
    const txn = await db.bankTransaction.findUnique({ where: { id: txnId } });
    if (!txn) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    let reconciledMonth: string | null = null;
    if (txn.postedAt) {
      const posted = new Date(txn.postedAt);
      reconciledMonth = `${posted.getFullYear()}-${String(posted.getMonth() + 1).padStart(2, "0")}`;
    }

    await db.bankTransaction.update({
      where: { id: txnId },
      data: {
        customerId,
        isReconciled: true,
        reconciledMonth,
      },
    });

    // Recalculate margins for the affected month
    if (reconciledMonth) {
      await recalculateMargins(db, reconciledMonth);
    }

    return NextResponse.json({ success: true, marginsRecalculated: !!reconciledMonth });
  }

  // parsed.data.action === "sync"
  const result = await mercury.syncTransactions(db);
  return NextResponse.json(result);
}
