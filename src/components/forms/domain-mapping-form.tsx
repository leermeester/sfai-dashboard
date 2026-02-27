"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface DomainRow {
  domain: string;
  meetingCount: number;
}

interface ExistingMapping {
  id: string;
  domain: string;
  meetingType: string;
  customerId: string | null;
}

interface Props {
  domains: DomainRow[];
  existingMappings: ExistingMapping[];
  customers: Array<{ id: string; displayName: string }>;
}

type MeetingType = "client" | "sales" | "internal" | "ignore" | null;

interface MappingState {
  meetingType: MeetingType;
  customerId: string | null;
}

const TYPE_CONFIG: Record<
  string,
  { label: string; key: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  client: { label: "Client", key: "c", variant: "default" },
  sales: { label: "Sales", key: "s", variant: "secondary" },
  internal: { label: "Internal", key: "i", variant: "outline" },
  ignore: { label: "Ignore", key: "x", variant: "destructive" },
};

export function DomainMappingForm({
  domains,
  existingMappings,
  customers,
}: Props) {
  // Build initial state from existing mappings
  const initialState: Record<string, MappingState> = {};
  for (const d of domains) {
    const existing = existingMappings.find((m) => m.domain === d.domain);
    initialState[d.domain] = {
      meetingType: (existing?.meetingType as MeetingType) ?? null,
      customerId: existing?.customerId ?? null,
    };
  }

  const router = useRouter();
  const [mappings, setMappings] =
    useState<Record<string, MappingState>>(initialState);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const setType = useCallback(
    (index: number, type: MeetingType) => {
      const domain = domains[index]?.domain;
      if (!domain) return;
      setMappings((prev) => ({
        ...prev,
        [domain]: {
          ...prev[domain],
          meetingType: type,
          customerId: type === "client" ? prev[domain]?.customerId ?? null : null,
        },
      }));
    },
    [domains]
  );

  const setCustomer = useCallback(
    (domain: string, customerId: string | null) => {
      setMappings((prev) => ({
        ...prev,
        [domain]: { ...prev[domain], customerId },
      }));
    },
    []
  );

  const moveFocus = useCallback(
    (delta: number) => {
      setFocusedIndex((prev) => {
        const next = prev + delta;
        if (next < 0) return 0;
        if (next >= domains.length) return domains.length - 1;
        return next;
      });
    },
    [domains.length]
  );

  const jumpToNextUnassigned = useCallback(() => {
    const startIdx = (focusedIndex + 1) % domains.length;
    for (let i = 0; i < domains.length; i++) {
      const idx = (startIdx + i) % domains.length;
      if (!mappings[domains[idx].domain]?.meetingType) {
        setFocusedIndex(idx);
        return;
      }
    }
  }, [focusedIndex, domains, mappings]);

  function handleKeyDown(e: React.KeyboardEvent) {
    // Don't intercept when a select/input is focused
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    // Allow select interactions
    if ((e.target as HTMLElement).closest("[data-slot='select-trigger']")) {
      if (e.key !== "Escape") return;
    }

    switch (e.key) {
      case "ArrowDown":
      case "j":
        e.preventDefault();
        moveFocus(1);
        break;
      case "ArrowUp":
      case "k":
        e.preventDefault();
        moveFocus(-1);
        break;
      case "c":
        e.preventDefault();
        setType(focusedIndex, "client");
        break;
      case "s":
        e.preventDefault();
        setType(focusedIndex, "sales");
        break;
      case "i":
        e.preventDefault();
        setType(focusedIndex, "internal");
        break;
      case "x":
        e.preventDefault();
        setType(focusedIndex, "ignore");
        break;
      case "Tab":
        e.preventDefault();
        jumpToNextUnassigned();
        break;
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const toSave = Object.entries(mappings)
        .filter(([, state]) => state.meetingType !== null)
        .map(([domain, state]) => ({
          domain,
          meetingType: state.meetingType,
          customerId: state.customerId,
        }));

      await fetch("/api/settings/domains", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings: toSave }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const unmappedCount = domains.filter(
    (d) => !mappings[d.domain]?.meetingType
  ).length;
  const mappedCount = domains.length - unmappedCount;

  if (domains.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No unmatched domains. Sync calendar data first.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Badge variant="secondary">{domains.length} domains</Badge>
        {unmappedCount > 0 && (
          <Badge variant="outline">{unmappedCount} unmapped</Badge>
        )}
        {mappedCount > 0 && (
          <Badge variant="default">{mappedCount} mapped</Badge>
        )}
      </div>

      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="relative w-full overflow-auto max-h-[600px] border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky top-0 z-10 bg-card min-w-[200px]">
                Domain
              </TableHead>
              <TableHead className="sticky top-0 z-10 bg-card text-center min-w-[80px]">
                Meetings
              </TableHead>
              <TableHead className="sticky top-0 z-10 bg-card min-w-[120px]">
                Type
              </TableHead>
              <TableHead className="sticky top-0 z-10 bg-card min-w-[160px]">
                Customer
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {domains.map((d, index) => {
              const state = mappings[d.domain];
              const isFocused = index === focusedIndex;
              return (
                <TableRow
                  key={d.domain}
                  className={cn(
                    "cursor-pointer transition-colors",
                    isFocused && "bg-accent",
                    !isFocused && state?.meetingType && "bg-muted/30"
                  )}
                  onClick={() => setFocusedIndex(index)}
                >
                  <TableCell className="font-mono text-sm py-1.5">
                    {isFocused && (
                      <span className="text-primary mr-1.5">&#9656;</span>
                    )}
                    {d.domain}
                  </TableCell>
                  <TableCell className="text-center tabular-nums text-sm py-1.5">
                    {d.meetingCount}
                  </TableCell>
                  <TableCell className="py-1.5">
                    {state?.meetingType ? (
                      <Badge
                        variant={
                          TYPE_CONFIG[state.meetingType]?.variant ?? "secondary"
                        }
                        className="text-xs"
                      >
                        {TYPE_CONFIG[state.meetingType]?.label ??
                          state.meetingType}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-1.5">
                    {state?.meetingType === "client" ? (
                      <Select
                        value={state.customerId ?? ""}
                        onValueChange={(val) =>
                          setCustomer(d.domain, val || null)
                        }
                      >
                        <SelectTrigger className="h-7 text-xs w-[150px]">
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
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Hotkey legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>
          <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">
            j
          </kbd>
          /
          <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">
            k
          </kbd>{" "}
          navigate
        </span>
        <span>
          <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">
            c
          </kbd>{" "}
          client
        </span>
        <span>
          <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">
            s
          </kbd>{" "}
          sales
        </span>
        <span>
          <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">
            i
          </kbd>{" "}
          internal
        </span>
        <span>
          <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">
            x
          </kbd>{" "}
          ignore
        </span>
        <span>
          <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">
            Tab
          </kbd>{" "}
          next unmapped
        </span>
      </div>

      <Button onClick={handleSave} disabled={saving}>
        <Save className="size-4 mr-1" />
        {saving ? "Saving..." : "Save Mappings"}
      </Button>
    </div>
  );
}
