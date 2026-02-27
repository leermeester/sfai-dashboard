export const dynamic = "force-dynamic";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/lib/db";
import { MarginTable } from "@/components/tables/margin-table";
import { EngineerCostMatrix } from "@/components/tables/engineer-cost-matrix";
import { MarginTrendChart } from "@/components/charts/margin-trend-chart";
import { getCurrentMonth, formatCurrency } from "@/lib/utils";
import { MonthPicker } from "@/components/month-picker";

export default async function MarginsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const selectedMonth = params.month ?? getCurrentMonth();

  const [teamMembers, customers, margins, costAllocations] = await Promise.all([
    db.teamMember.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    db.customer.findMany({
      where: { isActive: true },
      orderBy: { displayName: "asc" },
    }),
    db.monthlyMargin.findMany({
      include: { customer: true },
      orderBy: [{ month: "desc" }],
    }),
    db.engineerCostAllocation.findMany({
      where: { month: selectedMonth },
      include: {
        teamMember: { select: { id: true, name: true } },
        customer: { select: { id: true, displayName: true } },
      },
    }),
  ]);

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

  // Build engineer breakdowns per customer for drill-down
  const engineerBreakdowns: Record<
    string,
    Array<{
      teamMemberId: string;
      teamMemberName: string;
      ticketCount: number;
      totalTickets: number;
      percentage: number;
      attributedCost: number;
    }>
  > = {};
  for (const alloc of costAllocations) {
    if (!engineerBreakdowns[alloc.customerId]) {
      engineerBreakdowns[alloc.customerId] = [];
    }
    engineerBreakdowns[alloc.customerId].push({
      teamMemberId: alloc.teamMemberId,
      teamMemberName: alloc.teamMember.name,
      ticketCount: alloc.ticketCount,
      totalTickets: alloc.totalTickets,
      percentage: alloc.percentage,
      attributedCost: alloc.attributedCost,
    });
  }

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

      {/* Engineer Cost Matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Engineer Cost Attribution</CardTitle>
          <CardDescription>
            Cost per engineer per customer for {selectedMonth}, based on bank
            payments and Linear ticket distribution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EngineerCostMatrix
            allocations={costAllocations.map((a) => ({
              teamMemberId: a.teamMemberId,
              teamMemberName: a.teamMember.name,
              customerId: a.customerId,
              customerName: a.customer.displayName,
              ticketCount: a.ticketCount,
              totalTickets: a.totalTickets,
              percentage: a.percentage,
              attributedCost: a.attributedCost,
            }))}
            engineers={teamMembers.map((m) => ({
              id: m.id,
              name: m.name,
            }))}
            customers={customers.map((c) => ({
              id: c.id,
              displayName: c.displayName,
            }))}
          />
        </CardContent>
      </Card>

      {/* Customer Margins with drill-down */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Margins</CardTitle>
          <CardDescription>
            Revenue vs engineering cost per customer for {selectedMonth}.
            {costAllocations.length > 0 && " Click a row to see engineer breakdown."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MarginTable
            margins={currentMargins.map((m) => ({
              customerId: m.customerId,
              customerName: m.customer.displayName,
              revenue: m.revenue,
              engineeringCost: m.engineeringCost,
              margin: m.margin,
              marginPercent: m.marginPercent,
            }))}
            engineerBreakdowns={engineerBreakdowns}
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
    </div>
  );
}
