"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Check, Loader2 } from "lucide-react";

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
  const router = useRouter();
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

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

    setSaving((prev) => ({ ...prev, [txnId]: true }));
    setError(null);

    try {
      const res = await fetch("/api/mercury", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reconcile", txnId, customerId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to reconcile (${res.status})`);
      }

      setSaved((prev) => ({ ...prev, [txnId]: true }));
      // Refresh server data after a brief delay to show success state
      setTimeout(() => router.refresh(), 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reconcile");
    } finally {
      setSaving((prev) => ({ ...prev, [txnId]: false }));
    }
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          {error}
        </div>
      )}
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
            <TableRow
              key={txn.id}
              className={saved[txn.id] ? "opacity-50" : undefined}
            >
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
                  disabled={saved[txn.id]}
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
                {saved[txn.id] ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Button
                    size="sm"
                    disabled={!assignments[txn.id] || saving[txn.id]}
                    onClick={() => handleReconcile(txn.id)}
                  >
                    {saving[txn.id] ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Save"
                    )}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
