"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

interface CostAllocation {
  teamMemberId: string;
  teamMemberName: string;
  customerId: string;
  customerName: string;
  ticketCount: number;
  totalTickets: number;
  percentage: number;
  attributedCost: number;
}

interface Engineer {
  id: string;
  name: string;
}

interface Customer {
  id: string;
  displayName: string;
}

export function EngineerCostMatrix({
  allocations,
  engineers,
  customers,
}: {
  allocations: CostAllocation[];
  engineers: Engineer[];
  customers: Customer[];
}) {
  if (allocations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No cost attribution data yet. Link engineer bank transactions and sync Linear tickets.
      </p>
    );
  }

  // Build matrix: engineerId -> customerId -> allocation
  const matrix = new Map<string, Map<string, CostAllocation>>();
  for (const alloc of allocations) {
    if (!matrix.has(alloc.teamMemberId)) {
      matrix.set(alloc.teamMemberId, new Map());
    }
    matrix.get(alloc.teamMemberId)!.set(alloc.customerId, alloc);
  }

  // Only show customers that have at least one allocation
  const activeCustomerIds = new Set(allocations.map((a) => a.customerId));
  const activeCustomers = customers.filter((c) => activeCustomerIds.has(c.id));

  // Only show engineers that have at least one allocation
  const activeEngineerIds = new Set(allocations.map((a) => a.teamMemberId));
  const activeEngineers = engineers.filter((e) => activeEngineerIds.has(e.id));

  // Column totals
  const customerTotals = new Map<string, number>();
  for (const alloc of allocations) {
    customerTotals.set(
      alloc.customerId,
      (customerTotals.get(alloc.customerId) ?? 0) + alloc.attributedCost
    );
  }

  // Row totals
  const engineerTotals = new Map<string, number>();
  for (const alloc of allocations) {
    engineerTotals.set(
      alloc.teamMemberId,
      (engineerTotals.get(alloc.teamMemberId) ?? 0) + alloc.attributedCost
    );
  }

  const grandTotal = allocations.reduce((sum, a) => sum + a.attributedCost, 0);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-background z-10">
              Engineer
            </TableHead>
            {activeCustomers.map((c) => (
              <TableHead key={c.id} className="text-right min-w-[100px]">
                {c.displayName}
              </TableHead>
            ))}
            <TableHead className="text-right font-bold min-w-[100px]">
              Total
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activeEngineers.map((eng) => {
            const engMap = matrix.get(eng.id);
            return (
              <TableRow key={eng.id}>
                <TableCell className="sticky left-0 bg-background z-10 font-medium">
                  {eng.name}
                </TableCell>
                {activeCustomers.map((cust) => {
                  const alloc = engMap?.get(cust.id);
                  return (
                    <TableCell
                      key={cust.id}
                      className="text-right tabular-nums"
                      title={
                        alloc
                          ? `${alloc.ticketCount}/${alloc.totalTickets} tickets (${alloc.percentage.toFixed(0)}%)`
                          : undefined
                      }
                    >
                      {alloc ? formatCurrency(alloc.attributedCost) : "-"}
                    </TableCell>
                  );
                })}
                <TableCell className="text-right tabular-nums font-medium">
                  {formatCurrency(engineerTotals.get(eng.id) ?? 0)}
                </TableCell>
              </TableRow>
            );
          })}
          {/* Totals row */}
          <TableRow className="border-t-2 font-medium">
            <TableCell className="sticky left-0 bg-background z-10">
              Total
            </TableCell>
            {activeCustomers.map((cust) => (
              <TableCell key={cust.id} className="text-right tabular-nums">
                {formatCurrency(customerTotals.get(cust.id) ?? 0)}
              </TableCell>
            ))}
            <TableCell className="text-right tabular-nums font-bold">
              {formatCurrency(grandTotal)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
