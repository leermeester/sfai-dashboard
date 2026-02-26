"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface ClientData {
  name: string;
  revenue: number;
}

interface Props {
  data: ClientData[];
  maxClients?: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload as ClientData;
  return (
    <div className="rounded-md border bg-background px-3 py-2 shadow-md text-xs">
      <p className="font-semibold">{d.name}</p>
      <p className="text-muted-foreground">{formatCurrency(d.revenue)}</p>
    </div>
  );
}

function RightLabel(props: any) {
  const { x, y, width, height, value } = props;
  if (!value) return <g />;
  return (
    <text
      x={x + width + 8}
      y={y + height / 2}
      fill="currentColor"
      fontSize={11}
      fontWeight={500}
      dominantBaseline="central"
    >
      {formatCurrency(value)}
    </text>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function ClientMixChart({ data, maxClients = 8 }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">No revenue data yet.</p>
      </div>
    );
  }

  const sorted = [...data]
    .filter((d) => d.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);

  const top = sorted.slice(0, maxClients);
  const othersRevenue = sorted
    .slice(maxClients)
    .reduce((s, d) => s + d.revenue, 0);
  const othersCount = sorted.length - maxClients;

  const chartData = [
    ...top,
    ...(othersRevenue > 0
      ? [{ name: `+${othersCount} others`, revenue: othersRevenue }]
      : []),
  ];

  const barHeight = Math.max(200, chartData.length * 36 + 16);

  return (
    <div style={{ height: barHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 70, bottom: 0, left: 0 }}
          barCategoryGap="24%"
        >
          <XAxis type="number" hide />
          <YAxis
            dataKey="name"
            type="category"
            fontSize={12}
            width={110}
            tick={{ fill: "currentColor" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
          />
          <Bar dataKey="revenue" radius={[0, 4, 4, 0]} label={<RightLabel />}>
            {chartData.map((entry, index) => (
              <Cell
                key={entry.name}
                fill={index < top.length ? "#1b1b1b" : "#a3a3a3"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
