"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function SyncButton({ type }: { type: "sheets" | "mercury" }) {
  const [loading, setLoading] = useState(false);

  async function handleSync() {
    setLoading(true);
    try {
      const res = await fetch(`/api/${type}`, { method: "POST" });
      if (res.ok) {
        window.location.reload();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSync}
      disabled={loading}
    >
      <RefreshCw className={`size-4 mr-1 ${loading ? "animate-spin" : ""}`} />
      Sync {type === "sheets" ? "Sheets" : "Mercury"}
    </Button>
  );
}
