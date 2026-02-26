"use client";

interface TeamLoadData {
  name: string;
  hours: number;
  capacity: number;
}

interface Props {
  data: TeamLoadData[];
}

export function TeamLoadBars({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          No demand forecasts yet.
        </p>
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => b.hours - a.hours);
  const maxHours = Math.max(
    ...sorted.map((d) => d.hours),
    sorted[0]?.capacity ?? 40
  );
  const scale = maxHours > 0 ? 100 / maxHours : 0;
  const capacityPct = ((sorted[0]?.capacity ?? 40) / maxHours) * 100;

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((member) => {
        const pct = member.hours * scale;
        const isOver = member.hours > member.capacity;
        const isHigh = member.hours > member.capacity * 0.85;

        return (
          <div key={member.name} className="flex items-center gap-2.5">
            <span className="text-xs w-20 truncate text-right text-muted-foreground">
              {member.name.split(" ")[0]}
            </span>
            <div className="flex-1 relative h-4 bg-muted rounded-sm overflow-hidden">
              <div
                className={`h-full rounded-sm transition-all ${
                  isOver
                    ? "bg-red-500"
                    : isHigh
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
              {/* Capacity marker line */}
              <div
                className="absolute top-0 h-full border-r-2 border-dashed border-muted-foreground/40"
                style={{ left: `${capacityPct}%` }}
              />
            </div>
            <span
              className={`text-xs font-medium w-8 text-right tabular-nums ${
                isOver
                  ? "text-red-600"
                  : isHigh
                    ? "text-amber-600"
                    : "text-muted-foreground"
              }`}
            >
              {member.hours}h
            </span>
          </div>
        );
      })}
      <div className="flex items-center gap-2.5 mt-1">
        <span className="w-20" />
        <div className="flex-1 relative">
          <span
            className="absolute text-[10px] text-muted-foreground -translate-x-1/2"
            style={{ left: `${capacityPct}%` }}
          >
            {sorted[0]?.capacity ?? 40}h
          </span>
        </div>
        <span className="w-8" />
      </div>
    </div>
  );
}
