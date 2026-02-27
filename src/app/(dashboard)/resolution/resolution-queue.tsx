"use client";

import { useCallback, useEffect, useState } from "react";
import { Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResolutionCard } from "@/components/resolution/resolution-card";
import { EngineerSplitCard } from "@/components/resolution/engineer-split-card";

interface Customer {
  id: string;
  displayName: string;
}

interface TeamMember {
  id: string;
  name: string;
}

interface ResolutionItem {
  id: string;
  type: string;
  status: string;
  sourceEntity: string;
  suggestedMatch: Record<string, unknown> | null;
  confidence: number;
  context: Record<string, unknown> | null;
}

interface Stats {
  pending: number;
  autoResolved: number;
  confirmed: number;
  rejected: number;
  byType: Record<string, number>;
}

const typeFilters = [
  { value: "all", label: "All" },
  { value: "customer_match", label: "Unmatched Income" },
  { value: "engineer_split", label: "Engineer Splits" },
];

export function ResolutionQueue({
  customers,
  teamMembers = [],
}: {
  customers: Customer[];
  teamMembers?: TeamMember[];
}) {
  const [items, setItems] = useState<ResolutionItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const typeParam = filter !== "all" ? `&type=${filter}` : "";
    const [itemsRes, statsRes] = await Promise.all([
      fetch(`/api/resolution?status=pending${typeParam}`),
      fetch("/api/resolution/stats"),
    ]);
    const itemsData = await itemsRes.json();
    const statsData = await statsRes.json();
    setItems(itemsData.items ?? []);
    setStats(statsData);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const firstItem = items[0];
      if (!firstItem) return;

      if (e.key === "y" && firstItem.suggestedMatch) {
        e.preventDefault();
        handleResolve(firstItem.id, {
          action: "approve",
          ...(firstItem.type === "customer_match"
            ? { customerId: (firstItem.suggestedMatch as Record<string, unknown>).id }
            : {}),
        });
      } else if (e.key === "s") {
        e.preventDefault();
        handleSkip(firstItem.id);
      } else if (e.key === "n") {
        e.preventDefault();
        // Toggle alternative picker — handled in card component
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [items]);

  const handleResolve = async (
    id: string,
    decision: Record<string, unknown>
  ) => {
    await fetch(`/api/resolution/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...decision, channel: "dashboard" }),
    });
    // Remove from local state and refetch stats
    setItems((prev) => prev.filter((item) => item.id !== id));
    const statsRes = await fetch("/api/resolution/stats");
    setStats(await statsRes.json());
  };

  const handleSkip = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Resolution Queue</h1>
        <p className="text-muted-foreground">
          Review and approve suggested data matches
        </p>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="flex items-center gap-4 text-sm">
          <span className="font-medium">
            {stats.pending} pending
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            {stats.autoResolved} auto-resolved
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            {stats.confirmed} confirmed
          </span>
        </div>
      )}

      {/* Filter tabs */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          {typeFilters.map((f) => (
            <TabsTrigger key={f.value} value={f.value} className="gap-1.5">
              {f.label}
              {stats?.byType[f.value] ? (
                <Badge
                  variant="secondary"
                  className="ml-1 h-5 min-w-[20px] px-1 text-[10px]"
                >
                  {stats.byType[f.value]}
                </Badge>
              ) : f.value === "all" && stats?.pending ? (
                <Badge
                  variant="secondary"
                  className="ml-1 h-5 min-w-[20px] px-1 text-[10px]"
                >
                  {stats.pending}
                </Badge>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Items */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-lg bg-muted"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Inbox className="mb-4 size-12 text-muted-foreground/40" />
          <h3 className="text-lg font-medium">All caught up</h3>
          <p className="text-sm text-muted-foreground">
            No pending items to review. Run a sync to check for new data.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) =>
            item.type === "engineer_split" ? (
              <EngineerSplitCard
                key={item.id}
                item={item as Parameters<typeof EngineerSplitCard>[0]["item"]}
                teamMembers={teamMembers}
                onResolve={handleResolve}
                onSkip={handleSkip}
              />
            ) : (
              <ResolutionCard
                key={item.id}
                item={item as Parameters<typeof ResolutionCard>[0]["item"]}
                customers={customers}
                onResolve={handleResolve}
                onSkip={handleSkip}
              />
            )
          )}
        </div>
      )}

      {/* Keyboard shortcuts hint */}
      {items.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-4">
          <span>Keyboard shortcuts:</span>
          <kbd className="rounded border px-1.5 py-0.5 font-mono">y</kbd>
          <span>Approve</span>
          <kbd className="rounded border px-1.5 py-0.5 font-mono">n</kbd>
          <span>Different match</span>
          <kbd className="rounded border px-1.5 py-0.5 font-mono">s</kbd>
          <span>Skip</span>
        </div>
      )}
    </div>
  );
}
