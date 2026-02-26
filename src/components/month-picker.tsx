"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  currentMonth: string; // "YYYY-MM"
  basePath?: string;
}

function getAdjacentMonth(month: string, offset: number): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(year, m - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(year, m - 1, 1);
  return date.toLocaleString("default", { month: "long", year: "numeric" });
}

function getLast12Months(): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }
  return months;
}

export function MonthPicker({ currentMonth, basePath = "/margins" }: Props) {
  const router = useRouter();
  const months = getLast12Months();

  function navigate(month: string) {
    router.push(`${basePath}?month=${month}`);
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => navigate(getAdjacentMonth(currentMonth, -1))}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <select
        value={currentMonth}
        onChange={(e) => navigate(e.target.value)}
        className="h-8 rounded-full border border-input bg-background px-3 text-sm"
      >
        {months.map((m) => (
          <option key={m} value={m}>
            {formatMonthLabel(m)}
          </option>
        ))}
      </select>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => navigate(getAdjacentMonth(currentMonth, 1))}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
