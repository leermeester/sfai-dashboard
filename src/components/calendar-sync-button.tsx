"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RefreshCw, Settings } from "lucide-react";

export function CalendarSyncButton() {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch("/api/calendar", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setResult(`Error: ${data.error}`);
        return;
      }
      const parts = [];
      if (data.created > 0) parts.push(`${data.created} new`);
      if (data.updated > 0) parts.push(`${data.updated} updated`);
      if (data.counts) {
        const c = data.counts;
        parts.push(`${c.client} client, ${c.sales} sales, ${c.internal} internal`);
      }
      let msg = parts.length > 0 ? parts.join(" | ") : "No meetings to sync";
      if (data.unmatchedDomains?.length > 0) {
        msg += `\nUnmatched domains: ${data.unmatchedDomains.join(", ")}`;
      }
      setResult(msg);
      router.refresh();
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
        <RefreshCw className={`size-3 mr-1 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Syncing..." : "Sync Calendar"}
      </Button>
      <Button variant="ghost" size="sm" asChild>
        <Link href="/settings?tab=domains">
          <Settings className="size-3 mr-1" />
          Map Domains
        </Link>
      </Button>
      {result && (
        <span className="text-xs text-muted-foreground whitespace-pre-line">
          {result}
        </span>
      )}
    </div>
  );
}
