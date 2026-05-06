"use client";

interface FounderBarData {
  name: string;
  activeClients: number;
  cap: number;
}

interface Props {
  founders: FounderBarData[];
  combined: {
    activeClients: number;
    cap: number;
  };
}

export function FounderCapacityBars({ founders, combined }: Props) {
  const all = [
    ...founders.map((f) => ({ label: f.name, current: f.activeClients, max: f.cap })),
    { label: "Combined", current: combined.activeClients, max: combined.cap },
  ];

  return (
    <div className="flex flex-col gap-3">
      {all.map((item) => {
        const pct = item.max > 0 ? (item.current / item.max) * 100 : 0;
        const isOver = item.current > item.max;
        const isHigh = pct >= 70;
        const isCritical = pct >= 90;

        return (
          <div key={item.label} className="flex items-center gap-3">
            <span className="text-sm w-20 text-right text-muted-foreground font-medium">
              {item.label}
            </span>
            <div className="flex-1 relative h-5 bg-muted rounded-sm overflow-hidden">
              <div
                className={`h-full rounded-sm transition-all ${
                  isOver || isCritical
                    ? "bg-red-500"
                    : isHigh
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
              {/* Cap marker */}
              <div
                className="absolute top-0 h-full border-r-2 border-dashed border-muted-foreground/40"
                style={{ left: "100%" }}
              />
            </div>
            <span
              className={`text-sm font-medium w-16 text-right tabular-nums ${
                isOver || isCritical
                  ? "text-red-600"
                  : isHigh
                    ? "text-amber-600"
                    : "text-muted-foreground"
              }`}
            >
              {item.current}/{item.max}
            </span>
          </div>
        );
      })}
    </div>
  );
}
