"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

interface Transaction {
  id: string;
  amount: number;
  description: string;
  counterpartyName: string | null;
  postedAt: string | null;
  status: string;
}

interface Customer {
  id: string;
  displayName: string;
}

interface Props {
  transactions: Transaction[];
  customers: Customer[];
}

export function UnreconciledTransactions({ transactions, customers }: Props) {
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  if (transactions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        All transactions are reconciled.
      </p>
    );
  }

  async function handleReconcile(txnId: string) {
    const customerId = assignments[txnId];
    if (!customerId) return;

    const res = await fetch("/api/mercury", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reconcile", txnId, customerId }),
    });

    if (res.ok) {
      window.location.reload();
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Counterparty</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Assign to</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((txn) => (
          <TableRow key={txn.id}>
            <TableCell className="text-sm">
              {txn.postedAt
                ? new Date(txn.postedAt).toLocaleDateString()
                : "-"}
            </TableCell>
            <TableCell className="text-sm">
              {txn.counterpartyName ?? "-"}
            </TableCell>
            <TableCell className="text-sm max-w-[200px] truncate">
              {txn.description}
            </TableCell>
            <TableCell className="text-right tabular-nums font-medium">
              {formatCurrency(txn.amount)}
            </TableCell>
            <TableCell>
              <Select
                onValueChange={(val) =>
                  setAssignments((prev) => ({ ...prev, [txn.id]: val }))
                }
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              <Button
                size="sm"
                variant="outline"
                disabled={!assignments[txn.id]}
                onClick={() => handleReconcile(txn.id)}
              >
                Assign
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
