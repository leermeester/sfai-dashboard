"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

// Perceptually distinct, wide-hue-spaced palette
const COLORS = [
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ef4444", // rose-500
  "#8b5cf6", // violet-500
  "#06b6d4", // cyan-500
  "#f97316", // orange-500
  "#84cc16", // lime-500
  "#ec4899", // pink-500
  "#0ea5e9", // sky-500
  "#eab308", // yellow-500
  "#14b8a6", // teal-500
];

const CAPACITY_HOURS = 40;

interface Props {
  teamMembers: Array<{ id: string; name: string }>;
  forecasts: Array<{
    teamMemberId: string | null;
    customerName: string;
    hoursNeeded: number;
    forecastType: string;
  }>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null;

  const nonZero = payload.filter((p: any) => p.value > 0);
  if (nonZero.length === 0) return null;

  const total = nonZero.reduce((sum: number, p: any) => sum + p.value, 0);

  return (
    <div className="rounded-md border bg-background px-3 py-2 shadow-md">
      <p className="mb-1 text-xs font-semibold">{label}</p>
      {nonZero.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2 text-xs">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}</span>
          <span className="ml-auto font-medium">{entry.value}h</span>
        </div>
      ))}
      <div className="mt-1 border-t pt-1 text-xs font-semibold">
        Total: {total}h
      </div>
    </div>
  );
}

/* eslint-enable @typescript-eslint/no-explicit-any */

export function CapacityChart({ teamMembers, forecasts }: Props) {
  const hasShortTerm = forecasts.some((f) => f.forecastType === "this_week");
  const hasLongTerm = forecasts.some((f) => f.forecastType === "next_week");

  const [forecastType, setForecastType] = useState<"this_week" | "next_week">(
    hasShortTerm ? "this_week" : "next_week"
  );

  const directMatch = forecasts.filter((f) => f.forecastType === forecastType);

  // Next week inherits this week's data when not explicitly set
  const isInherited =
    forecastType === "next_week" && directMatch.length === 0;
  const filtered = isInherited
    ? forecasts.filter((f) => f.forecastType === "this_week")
    : directMatch;

  // Derive customers from ALL forecasts so colors stay stable across toggles
  const allCustomerNames = [
    ...new Set(forecasts.map((f) => f.customerName)),
  ].sort();
  const colorMap: Record<string, string> = {};
  allCustomerNames.forEach((name, i) => {
    colorMap[name] = COLORS[i % COLORS.length];
  });

  // Customers present in the current period
  const customerNames = allCustomerNames.filter((name) =>
    filtered.some((f) => f.customerName === name)
  );

  // Build one row per person (single period)
  const people = [
    ...teamMembers.map((m) => ({ id: m.id, name: m.name })),
    ...(filtered.some((f) => !f.teamMemberId)
      ? [{ id: null as string | null, name: "Unassigned" }]
      : []),
  ];

  const chartData: Array<Record<string, string | number>> = [];

  for (const person of people) {
    const entry: Record<string, string | number> = {
      name: person.name,
    };
    let total = 0;
    for (const customer of customerNames) {
      const hours = filtered
        .filter(
          (f) =>
            (person.id === null
              ? !f.teamMemberId
              : f.teamMemberId === person.id) &&
            f.customerName === customer
        )
        .reduce((sum, f) => sum + f.hoursNeeded, 0);
      entry[customer] = hours;
      total += hours;
    }
    entry._total = total;
    chartData.push(entry);
  }

  // Sort by total hours descending
  chartData.sort((a, b) => (b._total as number) - (a._total as number));

  // Account for bars + x-axis + legend rows
  const legendRows = Math.ceil(customerNames.length / 4);
  const barHeight = Math.max(
    300,
    chartData.length * 44 + 60 + legendRows * 24
  );

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const renderTotalLabel = (props: any) => {
    const { x, y, width, height, index } = props;
    const total = chartData[index]?._total as number;
    if (!total) return <g />;
    return (
      <text
        x={x + width + 6}
        y={y + height / 2}
        fill="currentColor"
        fontSize={11}
        fontWeight={600}
        dominantBaseline="central"
      >
        {total}h
      </text>
    );
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const periodToggle = (
    <div className="mb-3 flex gap-1 rounded-md bg-muted p-1 w-fit">
      <button
        onClick={() => setForecastType("this_week")}
        className={`rounded-sm px-3 py-1 text-xs font-medium transition-colors ${
          forecastType === "this_week"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        This Week
      </button>
      <button
        onClick={() => setForecastType("next_week")}
        className={`rounded-sm px-3 py-1 text-xs font-medium transition-colors ${
          forecastType === "next_week"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Next Week
      </button>
    </div>
  );

  if (forecasts.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          No demand forecasts yet. Add them below.
        </p>
      </div>
    );
  }

  return (
    <div>
      {periodToggle}

      {filtered.length === 0 ? (
        <div className="flex h-[200px] items-center justify-center">
          <p className="text-sm text-muted-foreground">
            No forecasts yet. Add them below.
          </p>
        </div>
      ) : (
        <div>
          {isInherited && (
            <p className="mb-2 text-xs text-muted-foreground">
              Showing this week&apos;s forecast. Edit in the form below to set
              next week separately.
            </p>
          )}
          <div style={{ height: barHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 48, bottom: 4, left: 4 }}
              barCategoryGap="25%"
            >
              <XAxis type="number" fontSize={12} unit="h" />
              <YAxis
                dataKey="name"
                type="category"
                fontSize={12}
                width={140}
                tick={{ fill: "currentColor" }}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
              />
              <ReferenceLine
                x={CAPACITY_HOURS}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `${CAPACITY_HOURS}h`,
                  position: "top",
                  fontSize: 11,
                  fill: "hsl(var(--muted-foreground))",
                }}
              />
              <Legend
                iconType="square"
                iconSize={10}
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              />
              {customerNames.map((customer, i) => (
                <Bar
                  key={customer}
                  dataKey={customer}
                  stackId="stack"
                  fill={colorMap[customer]}
                  radius={
                    i === customerNames.length - 1
                      ? [0, 4, 4, 0]
                      : undefined
                  }
                  label={
                    i === customerNames.length - 1
                      ? renderTotalLabel
                      : undefined
                  }
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
