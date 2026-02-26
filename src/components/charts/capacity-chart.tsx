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

interface Props {
  teamMembers: Array<{ id: string; name: string }>;
  forecasts: Array<{
    teamMemberId: string | null;
    customerName: string;
    hoursNeeded: number;
  }>;
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function CapacityChart({ teamMembers, forecasts }: Props) {
  if (forecasts.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          No demand forecasts yet. Add them below.
        </p>
      </div>
    );
  }

  // Get unique customer names
  const customerNames = [...new Set(forecasts.map((f) => f.customerName))];

  // Build chart data: one entry per team member
  const chartData = teamMembers.map((member) => {
    const entry: Record<string, string | number> = { name: member.name };
    for (const customer of customerNames) {
      const hours = forecasts
        .filter(
          (f) =>
            f.teamMemberId === member.id && f.customerName === customer
        )
        .reduce((sum, f) => sum + f.hoursNeeded, 0);
      entry[customer] = hours;
    }
    return entry;
  });

  // Add "Unassigned" row
  const unassigned: Record<string, string | number> = { name: "Unassigned" };
  for (const customer of customerNames) {
    const hours = forecasts
      .filter((f) => !f.teamMemberId && f.customerName === customer)
      .reduce((sum, f) => sum + f.hoursNeeded, 0);
    unassigned[customer] = hours;
  }
  if (Object.values(unassigned).some((v) => typeof v === "number" && v > 0)) {
    chartData.push(unassigned);
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} layout="vertical">
        <XAxis type="number" fontSize={12} />
        <YAxis dataKey="name" type="category" fontSize={12} width={100} />
        <Tooltip />
        <Legend />
        {customerNames.map((customer, i) => (
          <Bar
            key={customer}
            dataKey={customer}
            stackId="hours"
            fill={COLORS[i % COLORS.length]}
            radius={i === customerNames.length - 1 ? [0, 4, 4, 0] : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
