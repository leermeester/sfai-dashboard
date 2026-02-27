"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Save, Trash2, Check, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface VendorRule {
  id: string;
  vendorPattern: string;
  category: string;
  displayName: string | null;
}

interface UncategorizedTransaction {
  id: string;
  amount: number;
  description: string;
  counterpartyName: string | null;
  postedAt: string | null;
}

interface Props {
  rules: VendorRule[];
  uncategorizedTransactions: UncategorizedTransaction[];
}

export function VendorCategoryForm({
  rules: initialRules,
  uncategorizedTransactions,
}: Props) {
  const router = useRouter();
  const [rules, setRules] = useState(initialRules);
  const [saving, setSaving] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [categoryAssignments, setCategoryAssignments] = useState<
    Record<string, string>
  >({});
  const [savingTxn, setSavingTxn] = useState<Record<string, boolean>>({});
  const [savedTxn, setSavedTxn] = useState<Record<string, boolean>>({});

  function addRule() {
    setRules((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        vendorPattern: "",
        category: "other",
        displayName: null,
      },
    ]);
  }

  function updateRule(
    index: number,
    field: keyof VendorRule,
    value: string
  ) {
    setRules((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value || null };
      return updated;
    });
  }

  function removeRule(index: number) {
    setRules((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/vendor-categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleCategorize(txnId: string) {
    const costCategory = categoryAssignments[txnId];
    if (!costCategory) return;

    setSavingTxn((prev) => ({ ...prev, [txnId]: true }));
    try {
      const res = await fetch("/api/mercury", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "categorize", txnId, costCategory }),
      });
      if (res.ok) {
        setSavedTxn((prev) => ({ ...prev, [txnId]: true }));
        setTimeout(() => router.refresh(), 500);
      }
    } finally {
      setSavingTxn((prev) => ({ ...prev, [txnId]: false }));
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor Pattern</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Display Name</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule, index) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    <Input
                      value={rule.vendorPattern}
                      onChange={(e) =>
                        updateRule(index, "vendorPattern", e.target.value)
                      }
                      placeholder="e.g. gusto, aws"
                      className="min-w-[150px]"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={rule.category}
                      onValueChange={(val) =>
                        updateRule(index, "category", val)
                      }
                    >
                      <SelectTrigger className="w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="labor">Labor</SelectItem>
                        <SelectItem value="software">Software</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={rule.displayName ?? ""}
                      onChange={(e) =>
                        updateRule(index, "displayName", e.target.value)
                      }
                      placeholder="e.g. Gusto Payroll"
                      className="min-w-[150px]"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteIndex(index)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={addRule}>
            <Plus className="size-4 mr-1" />
            Add Rule
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="size-4 mr-1" />
            {saving ? "Saving..." : "Save All"}
          </Button>
          <Badge variant="secondary" className="self-center">
            {rules.length} rules
          </Badge>
        </div>
      </div>

      {uncategorizedTransactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Uncategorized Transactions
            </CardTitle>
            <CardDescription>
              {uncategorizedTransactions.length} outgoing transactions need
              categorization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Counterparty</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uncategorizedTransactions.map((txn) => (
                  <TableRow
                    key={txn.id}
                    className={savedTxn[txn.id] ? "opacity-50" : undefined}
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
                      {formatCurrency(Math.abs(txn.amount))}
                    </TableCell>
                    <TableCell>
                      <Select
                        onValueChange={(val) =>
                          setCategoryAssignments((prev) => ({
                            ...prev,
                            [txn.id]: val,
                          }))
                        }
                        disabled={savedTxn[txn.id]}
                      >
                        <SelectTrigger className="w-[130px]">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="labor">Labor</SelectItem>
                          <SelectItem value="software">Software</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {savedTxn[txn.id] ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Button
                          size="sm"
                          disabled={
                            !categoryAssignments[txn.id] || savingTxn[txn.id]
                          }
                          onClick={() => handleCategorize(txn.id)}
                        >
                          {savingTxn[txn.id] ? (
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
          </CardContent>
        </Card>
      )}

      <AlertDialog open={deleteIndex !== null} onOpenChange={(open) => !open && setDeleteIndex(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove vendor rule?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteIndex !== null && rules[deleteIndex]
                ? `The rule for "${rules[deleteIndex].vendorPattern || "unnamed pattern"}" will be removed. Save to persist the change.`
                : "This vendor rule will be removed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteIndex !== null) removeRule(deleteIndex);
                setDeleteIndex(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
