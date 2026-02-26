"use client";

import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Save } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  month: string;
  teamMembers: Array<{ id: string; name: string; monthlyCost: number }>;
  customers: Array<{ id: string; displayName: string }>;
  existingAllocations: Array<{
    id: string;
    teamMemberId: string;
    customerId: string;
    percentage: number;
  }>;
}

export function TimeAllocationForm({
  month,
  teamMembers,
  customers,
  existingAllocations,
}: Props) {
  // Build initial allocation grid: teamMember x customer -> percentage
  const initialGrid: Record<string, Record<string, number>> = {};
  for (const member of teamMembers) {
    initialGrid[member.id] = {};
    for (const customer of customers) {
      const existing = existingAllocations.find(
        (a) =>
          a.teamMemberId === member.id && a.customerId === customer.id
      );
      initialGrid[member.id][customer.id] = existing?.percentage ?? 0;
    }
  }

  const [grid, setGrid] = useState(initialGrid);
  const [saving, setSaving] = useState(false);

  function updateCell(
    memberId: string,
    customerId: string,
    value: number
  ) {
    setGrid((prev) => ({
      ...prev,
      [memberId]: { ...prev[memberId], [customerId]: value },
    }));
  }

  function getMemberTotal(memberId: string): number {
    return Object.values(grid[memberId] ?? {}).reduce(
      (sum, v) => sum + v,
      0
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const allocations: Array<{
        teamMemberId: string;
        customerId: string;
        percentage: number;
      }> = [];

      for (const [memberId, customerMap] of Object.entries(grid)) {
        for (const [customerId, percentage] of Object.entries(customerMap)) {
          if (percentage > 0) {
            allocations.push({
              teamMemberId: memberId,
              customerId,
              percentage,
            });
          }
        }
      }

      await fetch("/api/settings/allocations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, allocations }),
      });

      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  if (teamMembers.length === 0 || customers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add team members and customers in Settings first.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-background">
                Engineer
              </TableHead>
              {customers.map((c) => (
                <TableHead key={c.id} className="text-center min-w-[100px]">
                  {c.displayName}
                </TableHead>
              ))}
              <TableHead className="text-center">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teamMembers.map((member) => {
              const total = getMemberTotal(member.id);
              return (
                <TableRow key={member.id}>
                  <TableCell className="sticky left-0 bg-background font-medium">
                    {member.name}
                  </TableCell>
                  {customers.map((customer) => (
                    <TableCell key={customer.id} className="text-center">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={grid[member.id]?.[customer.id] ?? 0}
                        onChange={(e) =>
                          updateCell(
                            member.id,
                            customer.id,
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-[70px] mx-auto text-center"
                      />
                    </TableCell>
                  ))}
                  <TableCell className="text-center">
                    <Badge
                      variant={
                        total > 100
                          ? "destructive"
                          : total >= 90
                          ? "default"
                          : "secondary"
                      }
                      className={cn(
                        "tabular-nums",
                        total > 100 && "bg-red-100 text-red-700",
                        total >= 90 &&
                          total <= 100 &&
                          "bg-green-100 text-green-700"
                      )}
                    >
                      {total}%
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Button onClick={handleSave} disabled={saving}>
        <Save className="size-4 mr-1" />
        {saving ? "Saving..." : "Save Allocations & Recalculate Margins"}
      </Button>
    </div>
  );
}
