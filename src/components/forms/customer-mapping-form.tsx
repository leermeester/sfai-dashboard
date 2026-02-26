"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Save, Trash2 } from "lucide-react";

interface DomainSuggestion {
  domain: string;
  meetingCount: number;
}

interface Customer {
  id: string;
  displayName: string;
  spreadsheetName: string | null;
  bankName: string | null;
  emailDomain: string | null;
  linearProjectId: string | null;
  email: string | null;
  aliases: string[];
  isActive: boolean;
}

export function CustomerMappingForm({
  customers: initialCustomers,
}: {
  customers: Customer[];
}) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [saving, setSaving] = useState(false);
  const [domainSuggestions, setDomainSuggestions] = useState<DomainSuggestion[]>([]);

  useEffect(() => {
    fetch("/api/calendar?domains=true")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.domains) setDomainSuggestions(data.domains);
      })
      .catch(() => {});
  }, []);

  function addCustomer() {
    setCustomers((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        displayName: "",
        spreadsheetName: null,
        bankName: null,
        emailDomain: null,
        linearProjectId: null,
        email: null,
        aliases: [],
        isActive: true,
      },
    ]);
  }

  function updateCustomer(index: number, field: string, value: string) {
    setCustomers((prev) => {
      const updated = [...prev];
      if (field === "aliases") {
        updated[index] = {
          ...updated[index],
          aliases: value.split(",").map((s) => s.trim()),
        };
      } else {
        updated[index] = { ...updated[index], [field]: value || null };
      }
      return updated;
    });
  }

  function removeCustomer(index: number) {
    setCustomers((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/customers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        customers: customers.map((c) => ({
          ...c,
          aliases: c.aliases.filter(Boolean),
        })),
      }),
      });
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Display Name</TableHead>
              <TableHead>Spreadsheet Name</TableHead>
              <TableHead>Bank Name</TableHead>
              <TableHead>Email Domain</TableHead>
              <TableHead>Linear Project ID</TableHead>
              <TableHead>Aliases (comma-separated)</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer, index) => (
              <TableRow key={customer.id}>
                <TableCell>
                  <Input
                    value={customer.displayName}
                    onChange={(e) =>
                      updateCustomer(index, "displayName", e.target.value)
                    }
                    placeholder="Customer name"
                    className="min-w-[150px]"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={customer.spreadsheetName ?? ""}
                    onChange={(e) =>
                      updateCustomer(index, "spreadsheetName", e.target.value)
                    }
                    placeholder="As in Google Sheets"
                    className="min-w-[150px]"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={customer.bankName ?? ""}
                    onChange={(e) =>
                      updateCustomer(index, "bankName", e.target.value)
                    }
                    placeholder="As in Mercury"
                    className="min-w-[150px]"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={customer.emailDomain ?? ""}
                    onChange={(e) =>
                      updateCustomer(index, "emailDomain", e.target.value)
                    }
                    placeholder="e.g. nouri.health"
                    className="min-w-[130px]"
                    list="domain-suggestions"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={customer.linearProjectId ?? ""}
                    onChange={(e) =>
                      updateCustomer(index, "linearProjectId", e.target.value)
                    }
                    placeholder="Linear project ID"
                    className="min-w-[150px]"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={customer.aliases.join(", ")}
                    onChange={(e) =>
                      updateCustomer(index, "aliases", e.target.value)
                    }
                    placeholder="alt name 1, alt name 2"
                    className="min-w-[200px]"
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCustomer(index)}
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
        <Button variant="outline" onClick={addCustomer}>
          <Plus className="size-4 mr-1" />
          Add Customer
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="size-4 mr-1" />
          {saving ? "Saving..." : "Save All"}
        </Button>
        <Badge variant="secondary" className="self-center">
          {customers.length} customers
        </Badge>
      </div>

      <datalist id="domain-suggestions">
        {domainSuggestions.map((s) => (
          <option key={s.domain} value={s.domain}>
            {s.domain} ({s.meetingCount} meetings)
          </option>
        ))}
      </datalist>
    </div>
  );
}
