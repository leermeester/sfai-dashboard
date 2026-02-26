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
import { formatCurrency } from "@/lib/utils";

interface CostDataPoint {
  month: string;
  labor: number;
  software: number;
  other: number;
}

interface Props {
  data: CostDataPoint[];
}

export function CostsBreakdownChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          No cost data yet. Sync Mercury transactions and set up vendor
          categories in Settings.
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <XAxis dataKey="month" fontSize={12} />
        <YAxis
          fontSize={12}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            formatCurrency(value),
            name,
          ]}
        />
        <Legend />
        <Bar
          dataKey="labor"
          name="Labor"
          stackId="costs"
          fill="#1b1b1b"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="software"
          name="Software"
          stackId="costs"
          fill="#53a945"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="other"
          name="Other"
          stackId="costs"
          fill="#c4b1f9"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
