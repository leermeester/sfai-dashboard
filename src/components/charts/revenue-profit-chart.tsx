"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface DataPoint {
  month: string;
  revenue: number;
  profit: number;
}

interface Props {
  data: DataPoint[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null;

  return (
    <div className="rounded-md border bg-background px-3 py-2 shadow-md">
      <p className="mb-1.5 text-xs font-semibold">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2 text-xs">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}</span>
          <span className="ml-auto font-medium tabular-nums">
            {formatCurrency(entry.value)}
          </span>
        </div>
      ))}
      {payload.length === 2 && (
        <div className="mt-1.5 border-t pt-1.5 text-xs text-muted-foreground">
          Margin:{" "}
          <span className="font-medium text-foreground">
            {payload[0].value > 0
              ? `${((payload[1].value / payload[0].value) * 100).toFixed(1)}%`
              : "\u2014"}
          </span>
        </div>
      )}
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function RevenueProfitChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          No revenue data yet. Sync your data sources in Settings.
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={data}
        margin={{ top: 4, right: 8, bottom: 0, left: -10 }}
      >
        <XAxis
          dataKey="month"
          fontSize={12}
          axisLine={false}
          tickLine={false}
          tick={{ fill: "hsl(var(--muted-foreground))" }}
        />
        <YAxis
          fontSize={11}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
          axisLine={false}
          tickLine={false}
          tick={{ fill: "hsl(var(--muted-foreground))" }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="square"
          iconSize={10}
          wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
        />
        <Bar
          dataKey="revenue"
          name="Revenue"
          fill="#1b1b1b"
          radius={[4, 4, 0, 0]}
        />
        <Line
          type="monotone"
          dataKey="profit"
          name="Profit"
          stroke="#53a945"
          strokeWidth={2.5}
          dot={{ r: 4, fill: "#53a945", strokeWidth: 0 }}
          activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
