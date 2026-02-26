"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatMonth } from "@/lib/utils";

interface Props {
  snapshots: Array<{
    month: string;
    amount: number;
    snapshotDate: string;
    customerName: string;
  }>;
  confirmedPayments: Record<string, number>;
}

export function ForecastAccuracyChart({ snapshots, confirmedPayments }: Props) {
  if (snapshots.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          No snapshot data yet. Take a snapshot in Settings.
        </p>
      </div>
    );
  }

  // Aggregate by month: total forecasted vs total confirmed
  const months = [...new Set(snapshots.map((s) => s.month))].sort();
  const chartData = months.map((month) => {
    const monthSnapshots = snapshots.filter((s) => s.month === month);
    const forecast = monthSnapshots.reduce((sum, s) => sum + s.amount, 0);

    // Sum confirmed payments for this month across all customers
    let actual = 0;
    for (const [key, amount] of Object.entries(confirmedPayments)) {
      if (key.endsWith(`-${month}`)) actual += amount;
    }

    return {
      month: formatMonth(month),
      Forecast: forecast,
      Actual: actual,
    };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData}>
        <XAxis dataKey="month" fontSize={12} />
        <YAxis
          fontSize={12}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          formatter={(value: number) =>
            `$${value.toLocaleString()}`
          }
        />
        <Legend />
        <Bar dataKey="Forecast" fill="#1b1b1b" radius={[6, 6, 0, 0]} />
        <Bar dataKey="Actual" fill="#53a945" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
