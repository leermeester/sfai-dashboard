"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Textarea } from "@/components/ui/textarea";
import { Plus, Save, Trash2 } from "lucide-react";

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

export function DemandForecastForm({
  forecastType,
  customers,
  teamMembers,
  existingForecasts,
}: Props) {
  const [forecasts, setForecasts] = useState<Forecast[]>(existingForecasts);
  const [saving, setSaving] = useState(false);

  function addForecast() {
    setForecasts((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        customerId: customers[0]?.id ?? "",
        teamMemberId: null,
        hoursNeeded: 0,
        confidence: "medium",
        notes: null,
      },
    ]);
  }

  function updateForecast(
    index: number,
    field: string,
    value: string | number | null
  ) {
    setForecasts((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function removeForecast(index: number) {
    setForecasts((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    try {
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

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Assigned To</TableHead>
            <TableHead>Hours Needed</TableHead>
            <TableHead>Confidence</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {forecasts.map((forecast, index) => (
            <TableRow key={forecast.id}>
              <TableCell>
                <Select
                  value={forecast.customerId}
                  onValueChange={(val) =>
                    updateForecast(index, "customerId", val)
                  }
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Select
                  value={forecast.teamMemberId ?? "unassigned"}
                  onValueChange={(val) =>
                    updateForecast(
                      index,
                      "teamMemberId",
                      val === "unassigned" ? null : val
                    )
                  }
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {teamMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  value={forecast.hoursNeeded}
                  onChange={(e) =>
                    updateForecast(
                      index,
                      "hoursNeeded",
                      parseFloat(e.target.value) || 0
                    )
                  }
                  className="w-[80px]"
                  min={0}
                />
              </TableCell>
              <TableCell>
                <Select
                  value={forecast.confidence ?? "medium"}
                  onValueChange={(val) =>
                    updateForecast(index, "confidence", val)
                  }
                >
                  <SelectTrigger className="w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Textarea
                  value={forecast.notes ?? ""}
                  onChange={(e) =>
                    updateForecast(index, "notes", e.target.value || null)
                  }
                  className="min-w-[150px] h-9"
                  placeholder="Optional notes"
                />
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeForecast(index)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex gap-2">
        <Button variant="outline" onClick={addForecast}>
          <Plus className="size-4 mr-1" />
          Add Forecast
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="size-4 mr-1" />
          {saving ? "Saving..." : "Save Forecasts"}
        </Button>
      </div>
    </div>
  );
}
