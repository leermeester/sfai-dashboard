"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Props {
  lastSyncedAt: string | null;
}

export function OverviewRefreshButton({ lastSyncedAt }: Props) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  async function handleRefresh() {
    setSyncing(true);
    try {
      const res = await fetch("/api/overview/refresh", { method: "POST" });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {lastSyncedAt && (
        <span className="text-xs text-muted-foreground">
          Last synced{" "}
          {formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })}
        </span>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handleRefresh}
        disabled={syncing}
      >
        <RefreshCw
          className={`size-4 mr-1 ${syncing ? "animate-spin" : ""}`}
        />
        {syncing ? "Syncing..." : "Refresh"}
      </Button>
    </div>
  );
}
