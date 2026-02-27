export const dynamic = "force-dynamic";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { db } from "@/lib/db";
import { formatCurrency, formatMonth, getCurrentMonth } from "@/lib/utils";
import { getCurrentWeekStart } from "@/lib/capacity";
import { RevenueProfitChart } from "@/components/charts/revenue-profit-chart";
import { ClientMixChart } from "@/components/charts/client-mix-chart";
import { CostRingChart } from "@/components/charts/cost-ring-chart";
import { TeamLoadBars } from "@/components/team-load-bars";
import { AttentionPanel, type Alert } from "@/components/attention-panel";
import { MonthPicker } from "@/components/month-picker";
import { OverviewRefreshButton } from "@/components/overview-refresh-button";

function getLastNMonths(n: number, endMonth?: string): string[] {
  const [year, month] = (endMonth ?? getCurrentMonth()).split("-").map(Number);
  const months: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1);
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }
  return months;
}

function getPrevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Format a MoM percentage change */
function formatDelta(current: number, previous: number): {
  label: string;
  positive: boolean | null;
} {
  if (previous === 0 && current === 0) return { label: "—", positive: null };
  if (previous === 0) return { label: "New", positive: true };
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const sign = pct >= 0 ? "+" : "";
  return {
    label: `${sign}${pct.toFixed(1)}%`,
    positive: pct > 0 ? true : pct < 0 ? false : null,
  };
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const selectedMonth = params.month ?? getCurrentMonth();
  const prevMonth = getPrevMonth(selectedMonth);
  const months = getLastNMonths(6, selectedMonth);

  // ─── Data queries ───────────────────────────────────────────

  const [
    snapshots,
    reconciledTxns,
    costSummaries,
    margins,
    teamMembers,
    forecasts,
    lastSync,
    unreconciledCount,
  ] = await Promise.all([
    db.salesSnapshot.findMany({
      where: { month: { in: months } },
      include: { customer: true },
      orderBy: { snapshotDate: "desc" },
    }),
    db.bankTransaction.findMany({
      where: {
        direction: "incoming",
        isReconciled: true,
        reconciledMonth: { in: months },
      },
      include: { customer: true },
    }),
    db.monthlyCostSummary.findMany({
      where: { month: { in: months } },
      orderBy: { month: "asc" },
    }),
    db.monthlyMargin.findMany({
      where: { month: { in: [selectedMonth, prevMonth] } },
      include: { customer: true },
    }),
    db.teamMember.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    db.demandForecast.findMany({
      where: { weekStart: getCurrentWeekStart() },
      include: { customer: true, teamMember: true },
    }),
    db.bankTransaction.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    db.bankTransaction.count({
      where: { direction: "incoming", isReconciled: false },
    }),
  ]);

  // ─── Revenue computation per month ──────────────────────────

  function getMonthRevenue(month: string) {
    // Bank transaction revenue (preferred)
    const txnByCustomer = new Map<string, number>();
    reconciledTxns
      .filter((t) => t.reconciledMonth === month && t.customer)
      .forEach((t) => {
        const name = t.customer!.displayName;
        txnByCustomer.set(name, (txnByCustomer.get(name) ?? 0) + t.amount);
      });

    // Snapshot fallback
    const snapByCustomer = new Map<string, number>();
    const seen = new Set<string>();
    snapshots
      .filter((s) => s.month === month)
      .forEach((s) => {
        const name = s.customer.displayName;
        if (!seen.has(name)) {
          seen.add(name);
          snapByCustomer.set(name, s.amount);
        }
      });

    const txnTotal = Array.from(txnByCustomer.values()).reduce(
      (s, v) => s + v,
      0
    );
    const byCustomer = txnTotal > 0 ? txnByCustomer : snapByCustomer;
    const total = Array.from(byCustomer.values()).reduce((s, v) => s + v, 0);

    return { byCustomer, total };
  }

  // ─── Chart data: Revenue & Profit trend ─────────────────────

  const trendData = months.map((month) => {
    const { total: revenue } = getMonthRevenue(month);
    const costSummary = costSummaries.find((c) => c.month === month);
    const engCost = margins
      .filter((m) => m.month === month)
      .reduce((s, m) => s + m.engineeringCost, 0);
    const totalCosts = costSummary ? costSummary.totalCost : engCost;
    return {
      month: formatMonth(month),
      revenue,
      profit: revenue - totalCosts,
    };
  });

  // ─── Current + previous month KPI values ────────────────────

  const current = trendData[trendData.length - 1] ?? {
    revenue: 0,
    profit: 0,
  };
  const previous = trendData[trendData.length - 2] ?? {
    revenue: 0,
    profit: 0,
  };

  const currentMarginPct =
    current.revenue > 0 ? (current.profit / current.revenue) * 100 : 0;
  const prevMarginPct =
    previous.revenue > 0 ? (previous.profit / previous.revenue) * 100 : 0;

  // ─── Utilization ────────────────────────────────────────────

  const totalForecastHours = forecasts.reduce(
    (s, f) => s + f.hoursNeeded,
    0
  );
  const totalCapacity = teamMembers.length * 40;
  const utilization =
    totalCapacity > 0 ? (totalForecastHours / totalCapacity) * 100 : 0;

  // ─── Client revenue for current month ───────────────────────

  const { byCustomer: currentCustomerRevenue } = getMonthRevenue(selectedMonth);
  const clientMixData = Array.from(currentCustomerRevenue.entries()).map(
    ([name, revenue]) => ({ name, revenue })
  );
  const activeClientCount = clientMixData.filter((c) => c.revenue > 0).length;

  // ─── Cost ring data ─────────────────────────────────────────

  const currentCosts = costSummaries.find((c) => c.month === selectedMonth);

  // ─── Team load data ─────────────────────────────────────────

  const teamLoadData = teamMembers.map((m) => ({
    name: m.name,
    hours: forecasts
      .filter((f) => f.teamMemberId === m.id)
      .reduce((s, f) => s + f.hoursNeeded, 0),
    capacity: 40,
  }));

  // ─── Attention alerts ───────────────────────────────────────

  const alerts: Alert[] = [];

  // Over-capacity team members
  const overloaded = teamLoadData.filter((d) => d.hours > d.capacity);
  for (const member of overloaded) {
    alerts.push({
      type: "critical",
      message: `${member.name.split(" ")[0]} at ${member.hours}h — over ${member.capacity}h capacity`,
    });
  }

  // Unreconciled incoming payments
  if (unreconciledCount > 0) {
    alerts.push({
      type: "warning",
      message: `${unreconciledCount} incoming payment${unreconciledCount > 1 ? "s" : ""} not matched to clients`,
    });
  }

  // Clients with negative or very low margin
  const currentMargins = margins.filter((m) => m.month === selectedMonth);
  for (const m of currentMargins) {
    if (m.marginPercent < 20 && m.revenue > 0) {
      alerts.push({
        type: "warning",
        message: `${m.customer.displayName} at ${m.marginPercent.toFixed(0)}% margin`,
      });
    }
  }

  // No forecast data
  if (forecasts.length === 0 && teamMembers.length > 0) {
    alerts.push({
      type: "info",
      message: "No demand forecasts entered for this month",
    });
  }

  // ─── MoM deltas ─────────────────────────────────────────────

  const revDelta = formatDelta(current.revenue, previous.revenue);
  const profitDelta = formatDelta(current.profit, previous.profit);
  const marginDelta = {
    label:
      currentMarginPct === 0 && prevMarginPct === 0
        ? "—"
        : `${currentMarginPct - prevMarginPct >= 0 ? "+" : ""}${(currentMarginPct - prevMarginPct).toFixed(1)}pp`,
    positive:
      currentMarginPct - prevMarginPct > 0
        ? true
        : currentMarginPct - prevMarginPct < 0
          ? false
          : null,
  };

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
          <p className="text-muted-foreground text-sm">
            Agency health at a glance &middot;{" "}
            {formatMonth(selectedMonth)}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <MonthPicker currentMonth={selectedMonth} basePath="/" />
          <OverviewRefreshButton
            lastSyncedAt={lastSync?.createdAt.toISOString() ?? null}
          />
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Revenue"
          value={current.revenue > 0 ? formatCurrency(current.revenue) : "—"}
          delta={revDelta}
          deltaDirection="up-is-good"
        />
        <KpiCard
          label="Net Profit"
          value={current.revenue > 0 ? formatCurrency(current.profit) : "—"}
          delta={profitDelta}
          deltaDirection="up-is-good"
        />
        <KpiCard
          label="Margin"
          value={current.revenue > 0 ? `${currentMarginPct.toFixed(1)}%` : "—"}
          delta={marginDelta}
          deltaDirection="up-is-good"
        />
        <KpiCard
          label="Utilization"
          value={
            forecasts.length > 0
              ? `${utilization.toFixed(0)}%`
              : "—"
          }
          subtitle={
            forecasts.length > 0
              ? `${totalForecastHours.toFixed(0)}h / ${totalCapacity}h capacity`
              : `${teamMembers.length} team members`
          }
        />
      </div>

      {/* Main charts row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Revenue &amp; Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <RevenueProfitChart data={trendData} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                Revenue by Client
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                {activeClientCount} active client{activeClientCount !== 1 ? "s" : ""}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] overflow-y-auto">
              <ClientMixChart data={clientMixData} maxClients={8} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Operational row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Cost Structure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[170px]">
              <CostRingChart
                labor={currentCosts?.laborCost ?? 0}
                software={currentCosts?.softwareCost ?? 0}
                other={currentCosts?.otherCost ?? 0}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Team Load</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[170px] overflow-y-auto">
              <TeamLoadBars data={teamLoadData} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Needs Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[170px] overflow-y-auto">
              <AttentionPanel alerts={alerts} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── KPI Card ───────────────────────────────────────────────

function KpiCard({
  label,
  value,
  delta,
  deltaDirection,
  subtitle,
}: {
  label: string;
  value: string;
  delta?: { label: string; positive: boolean | null };
  deltaDirection?: "up-is-good" | "down-is-good";
  subtitle?: string;
}) {
  const isGood =
    delta && deltaDirection
      ? deltaDirection === "up-is-good"
        ? delta.positive
        : delta.positive === null
          ? null
          : !delta.positive
      : null;

  return (
    <Card className="py-4 gap-0">
      <CardContent className="pb-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        <p className="text-2xl font-bold mt-1 tabular-nums">{value}</p>
        {delta && (
          <div
            className={`flex items-center gap-1 mt-1 text-xs font-medium ${
              isGood === true
                ? "text-emerald-600"
                : isGood === false
                  ? "text-red-600"
                  : "text-muted-foreground"
            }`}
          >
            {isGood === true ? (
              <TrendingUp className="size-3" />
            ) : isGood === false ? (
              <TrendingDown className="size-3" />
            ) : (
              <Minus className="size-3" />
            )}
            <span>{delta.label} vs last month</span>
          </div>
        )}
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
