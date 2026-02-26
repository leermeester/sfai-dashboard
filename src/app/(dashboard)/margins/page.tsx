export const dynamic = "force-dynamic";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/lib/db";
import { TimeAllocationForm } from "@/components/forms/time-allocation-form";
import { MarginTable } from "@/components/tables/margin-table";
import { MarginTrendChart } from "@/components/charts/margin-trend-chart";
import { getCurrentMonth, formatCurrency, getWeeksInMonth } from "@/lib/utils";
import { syncLinearAllocations } from "@/lib/linear-sync";
import { MonthPicker } from "@/components/month-picker";

export default async function MarginsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const teamMembers = await db.teamMember.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  const customers = await db.customer.findMany({
    where: { isActive: true },
    orderBy: { displayName: "asc" },
  });

  const selectedMonth = params.month ?? getCurrentMonth();
  const weeks = getWeeksInMonth(selectedMonth);

  // Auto-sync Linear data on page load (uses daily cache)
  let syncStatus = {
    synced: false,
    syncedAt: null as string | null,
    error: null as string | null,
    issueCount: 0,
    unmappedCount: 0,
  };
  try {
    const result = await syncLinearAllocations(selectedMonth, false);
    const cache = await db.linearSyncCache.findUnique({
      where: { month: selectedMonth },
    });
    syncStatus = {
      synced: !!cache,
      syncedAt: cache?.syncedAt.toISOString() ?? null,
      error: null,
      issueCount: result.issueCount,
      unmappedCount: result.unmappedCount,
    };
  } catch (e) {
    syncStatus.error = String(e);
  }

  const allocations = await db.timeAllocation.findMany({
    where: { month: selectedMonth },
    include: { teamMember: true, customer: true },
  });

  const margins = await db.monthlyMargin.findMany({
    include: { customer: true },
    orderBy: [{ month: "desc" }],
  });

  // Calculate totals for current month
  const currentMargins = margins.filter((m) => m.month === selectedMonth);
  const totalRevenue = currentMargins.reduce((sum, m) => sum + m.revenue, 0);
  const totalCost = currentMargins.reduce(
    (sum, m) => sum + m.engineeringCost,
    0
  );
  const totalMargin = totalRevenue - totalCost;
  const avgMarginPercent =
    totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Margins</h2>
          <p className="text-muted-foreground">
            Per-customer profitability and cost analysis.
          </p>
        </div>
        <MonthPicker currentMonth={selectedMonth} />
      </div>

      {/* P&L Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalRevenue)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Engineering Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalCost)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Gross Margin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalMargin)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Margin %</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {avgMarginPercent.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Margin Table */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Margins</CardTitle>
          <CardDescription>
            Revenue vs engineering cost per customer for {selectedMonth}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MarginTable
            margins={currentMargins.map((m) => ({
              customerName: m.customer.displayName,
              revenue: m.revenue,
              engineeringCost: m.engineeringCost,
              margin: m.margin,
              marginPercent: m.marginPercent,
            }))}
          />
        </CardContent>
      </Card>

      {/* Margin Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Margin Trend</CardTitle>
          <CardDescription>Margin % by customer over time.</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          <MarginTrendChart
            margins={margins.map((m) => ({
              month: m.month,
              customerName: m.customer.displayName,
              marginPercent: m.marginPercent,
            }))}
          />
        </CardContent>
      </Card>

      {/* Time Allocation Form */}
      <Card>
        <CardHeader>
          <CardTitle>Time Allocation</CardTitle>
          <CardDescription>
            Weekly allocation percentages per engineer per customer for{" "}
            {selectedMonth}. Auto-populated from Linear completed tickets.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TimeAllocationForm
            month={selectedMonth}
            weeks={weeks.map((w) => ({
              weekNumber: w.weekNumber,
              label: w.label,
            }))}
            teamMembers={teamMembers.map((m) => ({
              id: m.id,
              name: m.name,
              monthlyCost: m.monthlyCost ?? 0,
            }))}
            customers={customers.map((c) => ({
              id: c.id,
              displayName: c.displayName,
            }))}
            existingAllocations={allocations.map((a) => ({
              teamMemberId: a.teamMemberId,
              customerId: a.customerId,
              week: a.week,
              percentage: a.percentage,
              source: a.source,
            }))}
            syncStatus={syncStatus}
          />
        </CardContent>
      </Card>
    </div>
  );
}
