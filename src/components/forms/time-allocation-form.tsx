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
import { AlertTriangle, RefreshCw, Save } from "lucide-react";
import { cn } from "@/lib/utils";

interface WeekInfo {
  weekNumber: number;
  label: string;
}

interface Props {
  month: string;
  weeks: WeekInfo[];
  teamMembers: Array<{ id: string; name: string; monthlyCost: number }>;
  customers: Array<{ id: string; displayName: string }>;
  existingAllocations: Array<{
    teamMemberId: string;
    customerId: string;
    week: number;
    percentage: number;
    source: string;
  }>;
  syncStatus: {
    synced: boolean;
    syncedAt: string | null;
    error?: string | null;
    issueCount?: number;
    unmappedCount?: number;
  };
}

// Grid: memberId -> customerId -> week -> { percentage, source }
type CellData = { percentage: number; source: string };
type Grid = Record<string, Record<string, Record<number, CellData>>>;

export function TimeAllocationForm({
  month,
  weeks,
  teamMembers,
  customers,
  existingAllocations,
  syncStatus,
}: Props) {
  // Build initial grid
  const initialGrid: Grid = {};
  for (const member of teamMembers) {
    initialGrid[member.id] = {};
    for (const customer of customers) {
      initialGrid[member.id][customer.id] = {};
      for (const week of weeks) {
        const existing = existingAllocations.find(
          (a) =>
            a.teamMemberId === member.id &&
            a.customerId === customer.id &&
            a.week === week.weekNumber
        );
        initialGrid[member.id][customer.id][week.weekNumber] = {
          percentage: existing?.percentage ?? 0,
          source: existing?.source ?? "manual",
        };
      }
    }
  }

  const [grid, setGrid] = useState<Grid>(initialGrid);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  function updateCell(
    memberId: string,
    customerId: string,
    weekNum: number,
    value: number
  ) {
    setGrid((prev) => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        [customerId]: {
          ...prev[memberId][customerId],
          [weekNum]: { percentage: value, source: "manual" },
        },
      },
    }));
  }

  function getWeekTotal(memberId: string, weekNum: number): number {
    let total = 0;
    for (const customerId of Object.keys(grid[memberId] ?? {})) {
      total += grid[memberId][customerId][weekNum]?.percentage ?? 0;
    }
    return total;
  }

  function getAvgTotal(memberId: string): number {
    const weekTotals = weeks.map((w) => getWeekTotal(memberId, w.weekNumber));
    const sum = weekTotals.reduce((a, b) => a + b, 0);
    return weeks.length > 0 ? Math.round((sum / weeks.length) * 10) / 10 : 0;
  }

  async function handleSync() {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/linear/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, forceRefresh: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSyncError(data.error ?? "Sync failed");
        setSyncing(false);
        return;
      }
      if (data.issueCount > 0 && data.count === 0) {
        setSyncError(
          `${data.issueCount} tickets found but none mapped. ${data.unmappedCount} unmapped. Check Linear IDs in Settings.`
        );
        setSyncing(false);
        return;
      }
      window.location.reload();
    } catch (e) {
      setSyncError(String(e));
      setSyncing(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const allocations: Array<{
        teamMemberId: string;
        customerId: string;
        week: number;
        percentage: number;
        source: string;
      }> = [];

      for (const [memberId, customerMap] of Object.entries(grid)) {
        for (const [customerId, weekMap] of Object.entries(customerMap)) {
          for (const [weekStr, cell] of Object.entries(weekMap)) {
            if (cell.percentage > 0) {
              allocations.push({
                teamMemberId: memberId,
                customerId,
                week: parseInt(weekStr),
                percentage: cell.percentage,
                source: cell.source,
              });
            }
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
      {/* Sync controls */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {syncStatus.synced && syncStatus.syncedAt
            ? `Last synced from Linear: ${new Date(syncStatus.syncedAt).toLocaleString()}`
            : "Not synced from Linear yet"}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
        >
          <RefreshCw
            className={cn("size-3.5 mr-1.5", syncing && "animate-spin")}
          />
          {syncing ? "Syncing..." : "Refresh from Linear"}
        </Button>
      </div>

      {/* Sync error / diagnostic banners */}
      {(syncStatus.error || syncError) && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Linear sync issue</p>
            <p>{syncError ?? syncStatus.error}</p>
            <p className="mt-1 text-xs text-amber-600">
              Check that Linear Project IDs and Linear User IDs are configured
              in Settings.
            </p>
          </div>
        </div>
      )}

      {!syncStatus.error &&
        !syncError &&
        syncStatus.synced &&
        (syncStatus.issueCount ?? 0) > 0 &&
        (syncStatus.unmappedCount ?? 0) > 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <p>
              {syncStatus.unmappedCount} of {syncStatus.issueCount} tickets
              could not be mapped to team members or customers. Check Linear IDs
              in Settings.
            </p>
          </div>
        )}

      {/* Allocation grid */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {/* Row 1: Customer names spanning week columns */}
            <TableRow>
              <TableHead
                rowSpan={2}
                className="sticky left-0 z-10 bg-card min-w-[120px]"
              >
                Engineer
              </TableHead>
              {customers.map((c, i) => (
                <TableHead
                  key={c.id}
                  colSpan={weeks.length}
                  className={cn(
                    "text-center text-xs font-semibold",
                    i > 0 && "border-l-2 border-muted"
                  )}
                >
                  {c.displayName}
                </TableHead>
              ))}
              <TableHead
                rowSpan={2}
                className="text-center text-xs min-w-[60px]"
              >
                Avg
              </TableHead>
            </TableRow>
            {/* Row 2: Week labels */}
            <TableRow>
              {customers.map((c, i) =>
                weeks.map((w, j) => (
                  <TableHead
                    key={`${c.id}-w${w.weekNumber}`}
                    className={cn(
                      "text-center text-[11px] text-muted-foreground min-w-[55px] px-1",
                      j === 0 && i > 0 && "border-l-2 border-muted"
                    )}
                  >
                    {w.label}
                  </TableHead>
                ))
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {teamMembers.map((member) => {
              const avg = getAvgTotal(member.id);
              return (
                <TableRow key={member.id}>
                  <TableCell className="sticky left-0 z-10 bg-card font-medium text-sm">
                    {member.name}
                  </TableCell>
                  {customers.map((customer, i) =>
                    weeks.map((w, j) => {
                      const cell =
                        grid[member.id]?.[customer.id]?.[w.weekNumber];
                      const isLinear = cell?.source === "linear";
                      return (
                        <TableCell
                          key={`${customer.id}-w${w.weekNumber}`}
                          className={cn(
                            "text-center px-1",
                            j === 0 && i > 0 && "border-l-2 border-muted",
                            isLinear && "bg-accent/50"
                          )}
                        >
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={cell?.percentage ?? 0}
                            onChange={(e) =>
                              updateCell(
                                member.id,
                                customer.id,
                                w.weekNumber,
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-[55px] mx-auto text-center text-xs h-8"
                          />
                        </TableCell>
                      );
                    })
                  )}
                  <TableCell className="text-center">
                    <Badge
                      variant={
                        avg > 100
                          ? "destructive"
                          : avg >= 90
                            ? "default"
                            : "secondary"
                      }
                      className={cn(
                        "tabular-nums text-xs",
                        avg > 100 && "bg-red-100 text-red-700",
                        avg >= 90 && avg <= 100 && "bg-green-100 text-green-700"
                      )}
                    >
                      {avg}%
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
