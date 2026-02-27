import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStats } from "@/lib/resolution-queue";

export async function GET() {
  try {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`;

    const [
      stats,
      // Reconciliation completeness: reconciled vs total incoming transactions
      currentMonthReconciled,
      currentMonthTotal,
      prevMonthReconciled,
      prevMonthTotal,
      // Expected revenue from snapshots
      currentMonthSnapshot,
      prevMonthSnapshot,
      // Unreconciled / uncategorized dollar amounts
      unreconciledIncoming,
      uncategorizedOutgoing,
      // Recent auto-resolved items (last 7 days)
      recentAutoResolved,
      // Confidence distribution of pending items
      pendingItems,
    ] = await Promise.all([
      getStats(db),
      db.bankTransaction.count({
        where: { direction: "incoming", isReconciled: true, reconciledMonth: currentMonth },
      }),
      db.bankTransaction.count({
        where: { direction: "incoming", postedAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } },
      }),
      db.bankTransaction.count({
        where: { direction: "incoming", isReconciled: true, reconciledMonth: prevMonth },
      }),
      db.bankTransaction.count({
        where: {
          direction: "incoming",
          postedAt: {
            gte: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1),
            lt: new Date(now.getFullYear(), now.getMonth(), 1),
          },
        },
      }),
      db.salesSnapshot.aggregate({
        where: { month: currentMonth },
        _sum: { amount: true },
      }),
      db.salesSnapshot.aggregate({
        where: { month: prevMonth },
        _sum: { amount: true },
      }),
      db.bankTransaction.aggregate({
        where: { direction: "incoming", isReconciled: false },
        _sum: { amount: true },
        _count: true,
      }),
      db.bankTransaction.aggregate({
        where: { direction: "outgoing", costCategory: null },
        _sum: { amount: true },
        _count: true,
      }),
      db.resolutionItem.count({
        where: {
          status: "auto_resolved",
          resolvedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      db.resolutionItem.findMany({
        where: { status: "pending" },
        select: { confidence: true, type: true },
      }),
    ]);

    // Confidence distribution
    const confidenceBuckets = { high: 0, medium: 0, low: 0 };
    for (const item of pendingItems) {
      if (item.confidence >= 80) confidenceBuckets.high++;
      else if (item.confidence >= 50) confidenceBuckets.medium++;
      else confidenceBuckets.low++;
    }

    // Reconciled revenue amounts
    const [currentMonthRevenueRec, prevMonthRevenueRec] = await Promise.all([
      db.bankTransaction.aggregate({
        where: { direction: "incoming", isReconciled: true, reconciledMonth: currentMonth },
        _sum: { amount: true },
      }),
      db.bankTransaction.aggregate({
        where: { direction: "incoming", isReconciled: true, reconciledMonth: prevMonth },
        _sum: { amount: true },
      }),
    ]);

    return NextResponse.json({
      queue: stats,
      reconciliation: {
        currentMonth: {
          month: currentMonth,
          reconciledCount: currentMonthReconciled,
          totalCount: currentMonthTotal,
          reconciledRevenue: currentMonthRevenueRec._sum.amount || 0,
          expectedRevenue: currentMonthSnapshot._sum.amount || 0,
          completeness: currentMonthTotal > 0 ? Math.round((currentMonthReconciled / currentMonthTotal) * 100) : 100,
        },
        previousMonth: {
          month: prevMonth,
          reconciledCount: prevMonthReconciled,
          totalCount: prevMonthTotal,
          reconciledRevenue: prevMonthRevenueRec._sum.amount || 0,
          expectedRevenue: prevMonthSnapshot._sum.amount || 0,
          completeness: prevMonthTotal > 0 ? Math.round((prevMonthReconciled / prevMonthTotal) * 100) : 100,
        },
      },
      unreconciled: {
        incoming: {
          count: unreconciledIncoming._count,
          amount: Math.abs(unreconciledIncoming._sum.amount || 0),
        },
        outgoing: {
          count: uncategorizedOutgoing._count,
          amount: Math.abs(uncategorizedOutgoing._sum.amount || 0),
        },
      },
      recentAutoResolved,
      confidenceDistribution: confidenceBuckets,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
