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
import { getCurrentMonth, formatCurrency } from "@/lib/utils";

export default async function MarginsPage() {
  const teamMembers = await db.teamMember.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  const customers = await db.customer.findMany({
    where: { isActive: true },
    orderBy: { displayName: "asc" },
  });

  const currentMonth = getCurrentMonth();
  const allocations = await db.timeAllocation.findMany({
    where: { month: currentMonth },
    include: { teamMember: true, customer: true },
  });

  const margins = await db.monthlyMargin.findMany({
    include: { customer: true },
    orderBy: [{ month: "desc" }],
  });

  // Calculate totals for current month
  const currentMargins = margins.filter((m) => m.month === currentMonth);
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
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Margins</h2>
        <p className="text-muted-foreground">
          Per-customer profitability and cost analysis.
        </p>
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
            Revenue vs engineering cost per customer for {currentMonth}.
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
            Estimate % of each engineer&apos;s time per project for{" "}
            {currentMonth}. Percentages per engineer should sum to ~100%.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TimeAllocationForm
            month={currentMonth}
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
              id: a.id,
              teamMemberId: a.teamMemberId,
              customerId: a.customerId,
              percentage: a.percentage,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
