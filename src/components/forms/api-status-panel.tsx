"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle, XCircle } from "lucide-react";

interface ConnectionStatus {
  mercury: boolean | null;
  linear: boolean | null;
  sheets: boolean | null;
}

export function ApiStatusPanel() {
  const [status, setStatus] = useState<ConnectionStatus>({
    mercury: null,
    linear: null,
    sheets: null,
  });
  const [testing, setTesting] = useState<string | null>(null);

  async function testConnection(service: keyof ConnectionStatus) {
    setTesting(service);
    try {
      const res = await fetch(`/api/${service}?test=true`);
      const data = await res.json();
      setStatus((prev) => ({ ...prev, [service]: data.connected }));
    } catch {
      setStatus((prev) => ({ ...prev, [service]: false }));
    } finally {
      setTesting(null);
    }
  }

  async function triggerSnapshot() {
    setTesting("snapshot");
    try {
      await fetch("/api/cron/snapshot", { method: "POST" });
      alert("Snapshot created successfully");
    } catch {
      alert("Failed to create snapshot");
    } finally {
      setTesting(null);
    }
  }

  const services = [
    {
      key: "mercury" as const,
      name: "Mercury Bank",
      description: "Bank transactions and payment verification",
      envVar: "MERCURY_API_KEY",
    },
    {
      key: "linear" as const,
      name: "Linear",
      description: "Project tracking and team workload",
      envVar: "LINEAR_API_KEY",
    },
    {
      key: "sheets" as const,
      name: "Google Sheets",
      description: "Sales pipeline spreadsheet",
      envVar: "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    },
  ];

  return (
    <div className="space-y-4">
      {services.map((service) => (
        <Card key={service.key}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{service.name}</CardTitle>
                <CardDescription>{service.description}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {status[service.key] === true && (
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-700 border-green-200"
                  >
                    <CheckCircle className="size-3 mr-1" />
                    Connected
                  </Badge>
                )}
                {status[service.key] === false && (
                  <Badge
                    variant="outline"
                    className="bg-red-50 text-red-700 border-red-200"
                  >
                    <XCircle className="size-3 mr-1" />
                    Failed
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testConnection(service.key)}
                  disabled={testing === service.key}
                >
                  <RefreshCw
                    className={`size-3 mr-1 ${testing === service.key ? "animate-spin" : ""}`}
                  />
                  Test
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Env: <code>{service.envVar}</code>
            </p>
          </CardContent>
        </Card>
      ))}

      {/* Snapshot Management */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Sales Snapshots</CardTitle>
              <CardDescription>
                Monthly snapshots of Google Sheets data for forecast tracking.
                Auto-runs on the 1st of each month.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={triggerSnapshot}
              disabled={testing === "snapshot"}
            >
              <RefreshCw
                className={`size-3 mr-1 ${testing === "snapshot" ? "animate-spin" : ""}`}
              />
              Take Snapshot Now
            </Button>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
