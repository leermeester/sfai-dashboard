import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as mercury from "@/lib/mercury";

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

  if (body.action === "reconcile") {
    const { txnId, customerId } = body;
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

    return NextResponse.json({ success: true });
  }

  // Default: sync transactions
  const result = await mercury.syncTransactions(db);
  return NextResponse.json(result);
}
