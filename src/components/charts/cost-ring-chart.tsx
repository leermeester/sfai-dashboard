"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils";

interface Props {
  labor: number;
  software: number;
  other: number;
}

const SEGMENTS = [
  { key: "labor", label: "Labor", color: "#1b1b1b" },
  { key: "software", label: "Software", color: "#53a945" },
  { key: "other", label: "Other", color: "#c4b1f9" },
] as const;

export function CostRingChart({ labor, software, other }: Props) {
  const total = labor + software + other;

  if (total === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          No cost data yet. Sync Mercury &amp; set up vendor categories.
        </p>
      </div>
    );
  }

  const values: Record<string, number> = { labor, software, other };
  const data = SEGMENTS.map((s) => ({
    name: s.label,
    value: values[s.key],
    color: s.color,
  })).filter((d) => d.value > 0);

  return (
    <div className="flex h-full items-center gap-6">
      <div className="relative h-[140px] w-[140px] flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={44}
              outerRadius={64}
              dataKey="value"
              strokeWidth={2}
              stroke="hsl(var(--card))"
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Total
          </span>
          <span className="text-sm font-bold">{formatCurrency(total)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {data.map((d) => {
          const pct = ((d.value / total) * 100).toFixed(0);
          return (
            <div key={d.name} className="flex items-center gap-2.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: d.color }}
              />
              <div className="flex flex-col">
                <span className="text-xs font-medium leading-none">
                  {formatCurrency(d.value)}
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                  {d.name} &middot; {pct}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
