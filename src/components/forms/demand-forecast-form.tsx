"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Save, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface Forecast {
  id: string;
  customerId: string;
  teamMemberId: string | null;
  hoursNeeded: number;
  confidence: string | null;
  notes: string | null;
}

interface Props {
  forecastType: string;
  customers: Array<{ id: string; displayName: string }>;
  teamMembers: Array<{ id: string; name: string }>;
  existingForecasts: Forecast[];
}

type CellData = {
  hoursNeeded: number;
  confidence: string | null;
  notes: string | null;
};
// Grid[customerId][teamMemberId | "unassigned"] = CellData
type Grid = Record<string, Record<string, CellData>>;

const UNASSIGNED = "unassigned";

function buildGrid(
  customers: Props["customers"],
  teamMembers: Props["teamMembers"],
  forecasts: Forecast[]
): Grid {
  const grid: Grid = {};
  const colKeys = [...teamMembers.map((m) => m.id), UNASSIGNED];

  for (const customer of customers) {
    grid[customer.id] = {};
    for (const colKey of colKeys) {
      const existing = forecasts.find(
        (f) =>
          f.customerId === customer.id &&
          (colKey === UNASSIGNED
            ? f.teamMemberId === null
            : f.teamMemberId === colKey)
      );
      grid[customer.id][colKey] = {
        hoursNeeded: existing?.hoursNeeded ?? 0,
        confidence: existing?.confidence ?? null,
        notes: existing?.notes ?? null,
      };
    }
  }
  return grid;
}

function getRowTotal(grid: Grid, customerId: string): number {
  let total = 0;
  for (const cell of Object.values(grid[customerId] ?? {})) {
    total += cell.hoursNeeded;
  }
  return total;
}

function getColTotal(grid: Grid, colKey: string): number {
  let total = 0;
  for (const customerCells of Object.values(grid)) {
    total += customerCells[colKey]?.hoursNeeded ?? 0;
  }
  return total;
}

function getGrandTotal(grid: Grid): number {
  let total = 0;
  for (const customerCells of Object.values(grid)) {
    for (const cell of Object.values(customerCells)) {
      total += cell.hoursNeeded;
    }
  }
  return total;
}

const confidenceLevels = [
  { value: "high", label: "H", color: "bg-green-100 text-green-700 border-green-300" },
  { value: "medium", label: "M", color: "bg-amber-100 text-amber-700 border-amber-300" },
  { value: "low", label: "L", color: "bg-red-100 text-red-700 border-red-300" },
];

function ConfidenceDot({ confidence }: { confidence: string | null }) {
  if (!confidence) return null;
  const level = confidenceLevels.find((l) => l.value === confidence);
  if (!level) return null;
  const dotColor =
    confidence === "high"
      ? "bg-green-500"
      : confidence === "medium"
        ? "bg-amber-500"
        : "bg-red-500";
  return <span className={cn("inline-block size-1.5 rounded-full", dotColor)} />;
}

export function DemandForecastForm({
  forecastType,
  customers,
  teamMembers,
  existingForecasts,
}: Props) {
  const [grid, setGrid] = useState<Grid>(() =>
    buildGrid(customers, teamMembers, existingForecasts)
  );
  const [saving, setSaving] = useState(false);

  const colKeys = [...teamMembers.map((m) => m.id), UNASSIGNED];
  const colNames: Record<string, string> = {};
  for (const m of teamMembers) colNames[m.id] = m.name;
  colNames[UNASSIGNED] = "Unassigned";

  function updateHours(
    customerId: string,
    colKey: string,
    value: number
  ) {
    setGrid((prev) => ({
      ...prev,
      [customerId]: {
        ...prev[customerId],
        [colKey]: { ...prev[customerId][colKey], hoursNeeded: value },
      },
    }));
  }

  function updateMeta(
    customerId: string,
    colKey: string,
    field: "confidence" | "notes",
    value: string | null
  ) {
    setGrid((prev) => ({
      ...prev,
      [customerId]: {
        ...prev[customerId],
        [colKey]: { ...prev[customerId][colKey], [field]: value },
      },
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const forecasts: Array<{
        customerId: string;
        teamMemberId: string | null;
        hoursNeeded: number;
        confidence: string | null;
        notes: string | null;
      }> = [];

      for (const [customerId, cols] of Object.entries(grid)) {
        for (const [colKey, cell] of Object.entries(cols)) {
          if (cell.hoursNeeded > 0) {
            forecasts.push({
              customerId,
              teamMemberId: colKey === UNASSIGNED ? null : colKey,
              hoursNeeded: cell.hoursNeeded,
              confidence: cell.confidence,
              notes: cell.notes,
            });
          }
        }
      }

      await fetch("/api/demand-forecast", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forecasts, forecastType }),
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
      <div className="relative w-full overflow-auto max-h-[500px] border rounded-md">
        <table className="w-full caption-bottom text-sm">
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 top-0 z-30 bg-card min-w-[120px]">
                Customer
              </TableHead>
              {colKeys.map((colKey) => (
                <TableHead
                  key={colKey}
                  className={cn(
                    "sticky top-0 z-20 bg-card text-center text-xs min-w-[70px] px-1",
                    colKey === UNASSIGNED && "border-l border-muted"
                  )}
                >
                  {colNames[colKey]}
                </TableHead>
              ))}
              <TableHead className="sticky top-0 z-20 bg-card text-center text-xs min-w-[50px] border-l border-muted">
                Total
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => {
              const rowTotal = getRowTotal(grid, customer.id);
              return (
                <TableRow key={customer.id}>
                  <TableCell className="sticky left-0 z-10 bg-card font-medium text-sm py-1">
                    {customer.displayName}
                  </TableCell>
                  {colKeys.map((colKey) => {
                    const cell = grid[customer.id]?.[colKey];
                    const hasMeta =
                      (cell?.confidence && cell.confidence !== null) ||
                      (cell?.notes && cell.notes !== null);
                    return (
                      <TableCell
                        key={colKey}
                        className={cn(
                          "text-center px-1 py-1",
                          colKey === UNASSIGNED && "border-l border-muted"
                        )}
                      >
                        <div className="flex items-center justify-center gap-0.5">
                          <Input
                            type="number"
                            min={0}
                            value={cell?.hoursNeeded ?? 0}
                            onChange={(e) =>
                              updateHours(
                                customer.id,
                                colKey,
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-[55px] text-center text-xs h-7"
                          />
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                className={cn(
                                  "flex items-center justify-center size-5 rounded shrink-0 transition-colors",
                                  hasMeta
                                    ? "text-muted-foreground hover:text-foreground"
                                    : "text-muted-foreground/30 hover:text-muted-foreground"
                                )}
                              >
                                {hasMeta ? (
                                  <ConfidenceDot confidence={cell?.confidence ?? null} />
                                ) : (
                                  <MessageSquare className="size-3" />
                                )}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-3 space-y-3">
                              <div className="space-y-1.5">
                                <p className="text-xs font-medium text-muted-foreground">
                                  Confidence
                                </p>
                                <div className="flex gap-1">
                                  {confidenceLevels.map((level) => (
                                    <button
                                      key={level.value}
                                      onClick={() =>
                                        updateMeta(
                                          customer.id,
                                          colKey,
                                          "confidence",
                                          cell?.confidence === level.value
                                            ? null
                                            : level.value
                                        )
                                      }
                                      className={cn(
                                        "flex-1 text-xs font-medium py-1 rounded border transition-colors",
                                        cell?.confidence === level.value
                                          ? level.color
                                          : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                                      )}
                                    >
                                      {level.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <p className="text-xs font-medium text-muted-foreground">
                                  Notes
                                </p>
                                <Textarea
                                  value={cell?.notes ?? ""}
                                  onChange={(e) =>
                                    updateMeta(
                                      customer.id,
                                      colKey,
                                      "notes",
                                      e.target.value || null
                                    )
                                  }
                                  placeholder="Optional notes..."
                                  className="text-xs min-h-[60px] h-[60px]"
                                />
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-center text-sm font-medium tabular-nums py-1 border-l border-muted">
                    {rowTotal > 0 ? `${rowTotal}h` : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
            {/* Totals row */}
            <TableRow className="border-t-2 font-medium">
              <TableCell className="sticky left-0 z-10 bg-card text-sm py-1">
                Total
              </TableCell>
              {colKeys.map((colKey) => {
                const total = getColTotal(grid, colKey);
                return (
                  <TableCell
                    key={colKey}
                    className={cn(
                      "text-center text-sm tabular-nums py-1",
                      colKey === UNASSIGNED && "border-l border-muted"
                    )}
                  >
                    {total > 0 ? `${total}h` : "—"}
                  </TableCell>
                );
              })}
              <TableCell className="text-center text-sm font-bold tabular-nums py-1 border-l border-muted">
                {getGrandTotal(grid) > 0 ? `${getGrandTotal(grid)}h` : "—"}
              </TableCell>
            </TableRow>
          </TableBody>
        </table>
      </div>

      <Button onClick={handleSave} disabled={saving}>
        <Save className="size-4 mr-1" />
        {saving ? "Saving..." : "Save Forecasts"}
      </Button>
    </div>
  );
}
