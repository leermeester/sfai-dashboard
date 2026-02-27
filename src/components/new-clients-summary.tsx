"use client";

import { formatCurrency } from "@/lib/utils";

interface FounderSlot {
  name: string;
  activeClients: number;
  cap: number;
}

interface Props {
  founders: FounderSlot[];
  slotsAvailable: number;
  revenueAtRisk: number;
  combinedCap: number;
  combinedActive: number;
}

export function NewClientsSummary({
  founders,
  slotsAvailable,
  revenueAtRisk,
  combinedCap,
  combinedActive,
}: Props) {
  const founderSlotText = founders
    .map((f) => `${f.name}: ${f.cap - f.activeClients}`)
    .join(", ");

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Slots Available */}
      <div className="rounded-lg border p-4">
        <p className="text-sm text-muted-foreground">Slots Available</p>
        <p className="text-2xl font-bold tabular-nums mt-1">
          {slotsAvailable}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {founderSlotText} (of {combinedCap} total)
        </p>
      </div>

      {/* Revenue at Risk */}
      <div className="rounded-lg border p-4">
        <p className="text-sm text-muted-foreground">Revenue at Risk</p>
        <p
          className={`text-2xl font-bold tabular-nums mt-1 ${
            revenueAtRisk > 0 ? "text-red-600" : ""
          }`}
        >
          {formatCurrency(revenueAtRisk)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          From clients with declining forecast
        </p>
      </div>

      {/* Active Clients */}
      <div className="rounded-lg border p-4">
        <p className="text-sm text-muted-foreground">Active Clients</p>
        <p className="text-2xl font-bold tabular-nums mt-1">
          {combinedActive}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {combinedCap - combinedActive} below cap of {combinedCap}
        </p>
      </div>
    </div>
  );
}
