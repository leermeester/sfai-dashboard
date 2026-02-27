"use client";

import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface ChurnRow {
  customerId: string;
  customerName: string;
  assignedFounder: string;
  currentRevenue: number;
  nextMonthRevenue: number;
  trend: "declining" | "ending";
}

interface Props {
  churnCandidates: ChurnRow[];
}

export function ChurnForecastTable({ churnCandidates }: Props) {
  if (churnCandidates.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="pb-2 font-medium text-muted-foreground">Client</th>
            <th className="pb-2 font-medium text-muted-foreground">Founder</th>
            <th className="pb-2 font-medium text-muted-foreground text-right">Current Revenue</th>
            <th className="pb-2 font-medium text-muted-foreground text-right">Next Month</th>
            <th className="pb-2 font-medium text-muted-foreground">Trend</th>
          </tr>
        </thead>
        <tbody>
          {churnCandidates.map((c) => (
            <tr key={c.customerId} className="border-b last:border-0">
              <td className="py-2 font-medium">{c.customerName}</td>
              <td className="py-2 text-muted-foreground">{c.assignedFounder}</td>
              <td className="py-2 text-right tabular-nums">{formatCurrency(c.currentRevenue)}</td>
              <td className="py-2 text-right tabular-nums">{formatCurrency(c.nextMonthRevenue)}</td>
              <td className="py-2">
                <Badge variant={c.trend === "ending" ? "destructive" : "secondary"}>
                  {c.trend === "ending" ? "Ending" : "Declining"}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
