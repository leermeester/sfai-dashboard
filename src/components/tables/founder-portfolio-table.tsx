"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface ClientRow {
  customerId: string;
  customerName: string;
  assignedFounder: string;
  revenue: number;
  margin: number;
  marginPercent: number;
  meetingCount: number;
  meetingMinutes: number;
}

interface Props {
  clients: ClientRow[];
}

type SortKey = "customerName" | "assignedFounder" | "revenue" | "margin" | "marginPercent" | "meetingCount" | "meetingMinutes";

function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function founderBadgeVariant(founder: string): "default" | "secondary" | "outline" | "destructive" {
  if (founder === "Unassigned") return "destructive";
  if (founder === "Both") return "outline";
  return "secondary";
}

export function FounderPortfolioTable({ clients }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortAsc, setSortAsc] = useState(false);

  if (clients.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No active clients with revenue or meetings this month.
      </p>
    );
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === "customerName" || key === "assignedFounder");
    }
  }

  const sorted = [...clients].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    const cmp = typeof aVal === "string"
      ? (aVal as string).localeCompare(bVal as string)
      : (aVal as number) - (bVal as number);
    return sortAsc ? cmp : -cmp;
  });

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortAsc ? " \u25B2" : " \u25BC") : "";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th
              className="pb-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground"
              onClick={() => handleSort("customerName")}
            >
              Client{sortIndicator("customerName")}
            </th>
            <th
              className="pb-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground"
              onClick={() => handleSort("assignedFounder")}
            >
              Founder{sortIndicator("assignedFounder")}
            </th>
            <th
              className="pb-2 font-medium text-muted-foreground text-right cursor-pointer hover:text-foreground"
              onClick={() => handleSort("revenue")}
            >
              Revenue{sortIndicator("revenue")}
            </th>
            <th
              className="pb-2 font-medium text-muted-foreground text-right cursor-pointer hover:text-foreground"
              onClick={() => handleSort("margin")}
            >
              Margin{sortIndicator("margin")}
            </th>
            <th
              className="pb-2 font-medium text-muted-foreground text-right cursor-pointer hover:text-foreground"
              onClick={() => handleSort("marginPercent")}
            >
              Margin %{sortIndicator("marginPercent")}
            </th>
            <th
              className="pb-2 font-medium text-muted-foreground text-right cursor-pointer hover:text-foreground"
              onClick={() => handleSort("meetingCount")}
            >
              Meetings{sortIndicator("meetingCount")}
            </th>
            <th
              className="pb-2 font-medium text-muted-foreground text-right cursor-pointer hover:text-foreground"
              onClick={() => handleSort("meetingMinutes")}
            >
              Hours{sortIndicator("meetingMinutes")}
            </th>
            <th
              className="pb-2 font-medium text-muted-foreground text-right cursor-pointer hover:text-foreground"
              onClick={() => handleSort("revenue")}
            >
              Rev/Slot
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => (
            <tr key={c.customerId} className="border-b last:border-0">
              <td className="py-2 font-medium">{c.customerName}</td>
              <td className="py-2">
                <Badge variant={founderBadgeVariant(c.assignedFounder)}>
                  {c.assignedFounder}
                </Badge>
              </td>
              <td className="py-2 text-right tabular-nums">
                {formatCurrency(c.revenue)}
              </td>
              <td className="py-2 text-right tabular-nums">
                {formatCurrency(c.margin)}
              </td>
              <td
                className={`py-2 text-right tabular-nums ${
                  c.marginPercent < 20
                    ? "text-red-600"
                    : c.marginPercent < 40
                      ? "text-amber-600"
                      : ""
                }`}
              >
                {c.marginPercent.toFixed(0)}%
              </td>
              <td className="py-2 text-right tabular-nums">{c.meetingCount}</td>
              <td className="py-2 text-right tabular-nums">
                {formatHours(c.meetingMinutes)}
              </td>
              <td className="py-2 text-right tabular-nums">
                {formatCurrency(c.revenue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
