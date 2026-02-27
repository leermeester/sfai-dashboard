"use client";

import { useState, Fragment } from "react";
import { ChevronRight } from "lucide-react";
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
  customerId?: string;
  customerName: string;
  revenue: number;
  engineeringCost: number;
  margin: number;
  marginPercent: number;
}

interface EngineerBreakdown {
  teamMemberId: string;
  teamMemberName: string;
  ticketCount: number;
  totalTickets: number;
  percentage: number;
  attributedCost: number;
}

export function MarginTable({
  margins,
  engineerBreakdowns = {},
}: {
  margins: MarginRow[];
  engineerBreakdowns?: Record<string, EngineerBreakdown[]>;
}) {
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);

  if (margins.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No margin data yet. Link engineer bank transactions and sync Linear tickets.
      </p>
    );
  }

  const hasBreakdowns = Object.keys(engineerBreakdowns).length > 0;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {hasBreakdowns && <TableHead className="w-8" />}
          <TableHead>Customer</TableHead>
          <TableHead className="text-right">Revenue</TableHead>
          <TableHead className="text-right">Eng. Cost</TableHead>
          <TableHead className="text-right">Margin</TableHead>
          <TableHead className="text-right">Margin %</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {margins.map((m) => {
          const key = m.customerId ?? m.customerName;
          const isExpanded = expandedCustomer === key;
          const breakdown = m.customerId
            ? (engineerBreakdowns[m.customerId] ?? [])
            : [];

          return (
            <Fragment key={key}>
              <TableRow
                className={cn(
                  hasBreakdowns && m.customerId && "cursor-pointer hover:bg-muted/50",
                  isExpanded && "bg-muted/30"
                )}
                onClick={() =>
                  hasBreakdowns && m.customerId &&
                  setExpandedCustomer(isExpanded ? null : key)
                }
              >
                {hasBreakdowns && (
                  <TableCell className="w-8 px-2">
                    {m.customerId && breakdown.length > 0 && (
                      <ChevronRight
                        className={cn(
                          "size-4 text-muted-foreground transition-transform",
                          isExpanded && "rotate-90"
                        )}
                      />
                    )}
                  </TableCell>
                )}
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
              {isExpanded && breakdown.length > 0 &&
                breakdown.map((eng) => (
                  <TableRow
                    key={`${key}-${eng.teamMemberId}`}
                    className="bg-muted/20"
                  >
                    {hasBreakdowns && <TableCell />}
                    <TableCell className="pl-8 text-sm text-muted-foreground">
                      {eng.teamMemberName}
                      <span className="ml-2 text-xs">
                        ({eng.ticketCount}/{eng.totalTickets} tickets,{" "}
                        {eng.percentage.toFixed(0)}%)
                      </span>
                    </TableCell>
                    <TableCell />
                    <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                      {formatCurrency(eng.attributedCost)}
                    </TableCell>
                    <TableCell />
                    <TableCell />
                  </TableRow>
                ))}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
