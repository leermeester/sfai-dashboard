import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { endOfMonth, endOfWeek, eachWeekOfInterval, format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(parseInt(year), parseInt(m) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export interface MonthWeek {
  weekNumber: number;
  startDate: Date;
  endDate: Date;
  label: string;
}

export function getWeeksInMonth(month: string): MonthWeek[] {
  const [year, m] = month.split("-").map(Number);
  const monthStart = new Date(year, m - 1, 1);
  const monthLast = endOfMonth(monthStart);

  const weekStarts = eachWeekOfInterval(
    { start: monthStart, end: monthLast },
    { weekStartsOn: 1 }
  );

  const weeks: MonthWeek[] = [];
  for (const monday of weekStarts) {
    const clampedStart = monday < monthStart ? monthStart : monday;
    const sunday = endOfWeek(monday, { weekStartsOn: 1 });
    const clampedEnd = sunday > monthLast ? monthLast : sunday;

    weeks.push({
      weekNumber: weeks.length + 1,
      startDate: clampedStart,
      endDate: clampedEnd,
      label: `${format(clampedStart, "MMM d")}-${format(clampedEnd, "d")}`,
    });
  }

  return weeks;
}

export function getWeekNumberInMonth(date: Date, month: string): number {
  const weeks = getWeeksInMonth(month);
  for (const week of weeks) {
    if (date >= week.startDate && date <= week.endDate) {
      return week.weekNumber;
    }
  }
  return weeks.length;
}
