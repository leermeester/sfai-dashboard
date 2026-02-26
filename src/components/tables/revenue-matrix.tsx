"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatMonth } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface RevenueMatrixProps {
  data: Array<{
    customerId: string;
    customerName: string;
    months: Record<string, number | null>;
  }>;
  months: string[];
  confirmedPayments: Record<string, number>;
}

export function RevenueMatrix({
  data,
  months,
  confirmedPayments,
}: RevenueMatrixProps) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No data available.</p>;
  }

  // Calculate column totals
  const totals = months.map((month) =>
    data.reduce((sum, row) => sum + (row.months[month] ?? 0), 0)
  );

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-background">
              Customer
            </TableHead>
            {months.map((month) => (
              <TableHead key={month} className="text-right min-w-[100px]">
                {formatMonth(month)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.customerId}>
              <TableCell className="sticky left-0 bg-background font-medium">
                {row.customerName}
              </TableCell>
              {months.map((month) => {
                const amount = row.months[month];
                const key = `${row.customerId}-${month}`;
                const confirmed = confirmedPayments[key];
                const isConfirmed = confirmed && confirmed > 0;

                return (
                  <TableCell
                    key={month}
                    className={cn(
                      "text-right tabular-nums",
                      amount && isConfirmed && "bg-green-50 text-green-700",
                      amount && !isConfirmed && "bg-yellow-50 text-yellow-700"
                    )}
                  >
                    {amount ? formatCurrency(amount) : "-"}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
          {/* Totals row */}
          <TableRow className="font-bold border-t-2">
            <TableCell className="sticky left-0 bg-background">
              Total
            </TableCell>
            {totals.map((total, i) => (
              <TableCell key={months[i]} className="text-right tabular-nums">
                {formatCurrency(total)}
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
