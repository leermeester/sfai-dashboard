"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, cn } from "@/lib/utils";

interface MarginRow {
  customerName: string;
  revenue: number;
  engineeringCost: number;
  margin: number;
  marginPercent: number;
}

export function MarginTable({ margins }: { margins: MarginRow[] }) {
  if (margins.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No margin data yet. Enter time allocations below and sync revenue data.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Customer</TableHead>
          <TableHead className="text-right">Revenue</TableHead>
          <TableHead className="text-right">Eng. Cost</TableHead>
          <TableHead className="text-right">Margin</TableHead>
          <TableHead className="text-right">Margin %</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {margins.map((m) => (
          <TableRow key={m.customerName}>
            <TableCell className="font-medium">{m.customerName}</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCurrency(m.revenue)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCurrency(m.engineeringCost)}
            </TableCell>
            <TableCell className="text-right tabular-nums font-medium">
              {formatCurrency(m.margin)}
            </TableCell>
            <TableCell
              className={cn(
                "text-right tabular-nums font-medium",
                m.marginPercent >= 50 && "text-green-600",
                m.marginPercent >= 20 &&
                  m.marginPercent < 50 &&
                  "text-yellow-600",
                m.marginPercent < 20 && "text-red-600"
              )}
            >
              {m.marginPercent.toFixed(1)}%
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
