"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatMonth } from "@/lib/utils";

interface Props {
  margins: Array<{
    month: string;
    customerName: string;
    marginPercent: number;
  }>;
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function MarginTrendChart({ margins }: Props) {
  if (margins.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          No margin data yet.
        </p>
      </div>
    );
  }

  const customerNames = [...new Set(margins.map((m) => m.customerName))];
  const months = [...new Set(margins.map((m) => m.month))].sort();

  const chartData = months.map((month) => {
    const entry: Record<string, string | number> = {
      month: formatMonth(month),
    };
    for (const customer of customerNames) {
      const margin = margins.find(
        (m) => m.month === month && m.customerName === customer
      );
      entry[customer] = margin?.marginPercent ?? 0;
    }
    return entry;
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData}>
        <XAxis dataKey="month" fontSize={12} />
        <YAxis fontSize={12} tickFormatter={(v) => `${v}%`} />
        <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
        <Legend />
        {customerNames.map((customer, i) => (
          <Line
            key={customer}
            type="monotone"
            dataKey={customer}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
