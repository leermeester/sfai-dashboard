export const dynamic = "force-dynamic";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { RevenueMatrix } from "@/components/tables/revenue-matrix";
import { UnreconciledTransactions } from "@/components/tables/unreconciled-transactions";
import { ForecastAccuracyChart } from "@/components/charts/forecast-accuracy-chart";
import { SyncButton } from "@/components/forms/sync-button";

export default async function SalesPage() {
  const customers = await db.customer.findMany({
    where: { isActive: true },
    orderBy: { displayName: "asc" },
  });

  const snapshots = await db.salesSnapshot.findMany({
    include: { customer: true },
    orderBy: [{ month: "asc" }, { snapshotDate: "desc" }],
  });

  const unreconciledTxns = await db.bankTransaction.findMany({
    where: { isReconciled: false },
    orderBy: { postedAt: "desc" },
    take: 50,
  });

  // Group snapshots by customer and month for the revenue matrix
  // Use the latest snapshot for each customer-month pair
  const latestSnapshots = new Map<string, { amount: number; snapshotDate: Date }>();
  for (const snap of snapshots) {
    const key = `${snap.customerId}-${snap.month}`;
    const existing = latestSnapshots.get(key);
    if (!existing || snap.snapshotDate > existing.snapshotDate) {
      latestSnapshots.set(key, { amount: snap.amount, snapshotDate: snap.snapshotDate });
    }
  }

  // Get unique months from snapshots
  const months = [...new Set(snapshots.map((s) => s.month))].sort();

  // Build revenue matrix data
  const matrixData = customers.map((customer) => ({
    customerId: customer.id,
    customerName: customer.displayName,
    months: Object.fromEntries(
      months.map((month) => {
        const key = `${customer.id}-${month}`;
        return [month, latestSnapshots.get(key)?.amount ?? null];
      })
    ),
  }));

  // Get reconciled transactions for confirmed payments
  const reconciledTxns = await db.bankTransaction.findMany({
    where: { isReconciled: true },
    include: { customer: true },
  });

  const confirmedPayments = new Map<string, number>();
  for (const txn of reconciledTxns) {
    if (txn.customerId && txn.reconciledMonth) {
      const key = `${txn.customerId}-${txn.reconciledMonth}`;
      confirmedPayments.set(key, (confirmedPayments.get(key) ?? 0) + txn.amount);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Sales & Revenue
          </h2>
          <p className="text-muted-foreground">
            Revenue pipeline and payment reconciliation.
          </p>
        </div>
        <div className="flex gap-2">
          <SyncButton type="sheets" />
          <SyncButton type="mercury" />
        </div>
      </div>

      {/* Revenue Matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Matrix</CardTitle>
          <CardDescription>
            Customers x months. <Badge variant="secondary">Green</Badge>{" "}
            = payment confirmed,{" "}
            <Badge variant="outline">Yellow</Badge> = forecasted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {matrixData.length > 0 ? (
            <RevenueMatrix
              data={matrixData}
              months={months}
              confirmedPayments={Object.fromEntries(confirmedPayments)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No data yet. Add customers in Settings and sync Google Sheets.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Forecast Accuracy */}
      <Card>
        <CardHeader>
          <CardTitle>Forecast Accuracy</CardTitle>
          <CardDescription>
            Forecast vs actual revenue by month.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ForecastAccuracyChart
            snapshots={snapshots.map((s) => ({
              month: s.month,
              amount: s.amount,
              snapshotDate: s.snapshotDate.toISOString(),
              customerName: s.customer.displayName,
            }))}
            confirmedPayments={Object.fromEntries(confirmedPayments)}
          />
        </CardContent>
      </Card>

      {/* Unreconciled Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>
            Unreconciled Transactions
            {unreconciledTxns.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreconciledTxns.length}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Mercury transactions not yet matched to a customer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UnreconciledTransactions
            transactions={unreconciledTxns.map((t) => ({
              id: t.id,
              amount: t.amount,
              description: t.description,
              counterpartyName: t.counterpartyName,
              postedAt: t.postedAt?.toISOString() ?? null,
              status: t.status,
            }))}
            customers={customers.map((c) => ({
              id: c.id,
              displayName: c.displayName,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
