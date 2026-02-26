import { db } from "./db";
import { getTeams, getCompletedIssues, type LinearIssue } from "./linear";
import { getWeeksInMonth, getWeekNumberInMonth } from "./utils";
import { endOfMonth } from "date-fns";

interface AllocationEntry {
  teamMemberId: string;
  customerId: string;
  month: string;
  week: number;
  percentage: number;
}

export interface SyncResult {
  allocations: AllocationEntry[];
  issueCount: number;
  unmappedCount: number;
}

/**
 * Sync completed tickets from Linear for a given month.
 * Uses a daily DB cache to avoid redundant API calls.
 * Computes weekly percentage allocations and persists them,
 * preserving any manual overrides.
 */
export async function syncLinearAllocations(
  month: string,
  forceRefresh = false
): Promise<SyncResult> {
  // 1. Check cache
  if (!forceRefresh) {
    const cached = await db.linearSyncCache.findUnique({ where: { month } });
    if (cached) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const syncDate = new Date(cached.syncedAt);
      syncDate.setHours(0, 0, 0, 0);
      if (syncDate.getTime() === today.getTime()) {
        const issues: LinearIssue[] = JSON.parse(cached.data);
        const { allocations, unmappedCount } = await computeAllocations(issues, month);
        return { allocations, issueCount: issues.length, unmappedCount };
      }
    }
  }

  // 2. Fetch from Linear
  const teams = await getTeams();
  const sfaiTeam = teams.find((t) =>
    t.name.toLowerCase().includes("sfai")
  );
  if (!sfaiTeam) throw new Error("SFAI Labs team not found in Linear");

  const [year, m] = month.split("-").map(Number);
  const monthStart = new Date(year, m - 1, 1);
  const monthLast = endOfMonth(monthStart);

  const issues = await getCompletedIssues(
    sfaiTeam.id,
    monthStart.toISOString(),
    monthLast.toISOString()
  );

  // 3. Update cache
  await db.linearSyncCache.upsert({
    where: { month },
    create: { month, syncedAt: new Date(), data: JSON.stringify(issues) },
    update: { syncedAt: new Date(), data: JSON.stringify(issues) },
  });

  // 4. Compute and persist
  const { allocations, unmappedCount } = await computeAllocations(issues, month);
  await persistLinearAllocations(allocations, month);

  return { allocations, issueCount: issues.length, unmappedCount };
}

async function computeAllocations(
  issues: LinearIssue[],
  month: string
): Promise<{ allocations: AllocationEntry[]; unmappedCount: number }> {
  // Build lookup maps
  const customers = await db.customer.findMany({
    where: { isActive: true, linearProjectId: { not: null } },
    select: { id: true, linearProjectId: true },
  });
  const projectToCustomer = new Map(
    customers.map((c) => [c.linearProjectId!, c.id])
  );

  const teamMembers = await db.teamMember.findMany({
    where: { isActive: true, linearUserId: { not: null } },
    select: { id: true, linearUserId: true },
  });
  const userToMember = new Map(
    teamMembers.map((m) => [m.linearUserId!, m.id])
  );

  getWeeksInMonth(month); // ensure weeks are computed

  // Count tickets per (member, customer, week)
  const ticketCounts = new Map<string, number>();
  const memberWeekTotals = new Map<string, number>();
  let unmappedCount = 0;

  for (const issue of issues) {
    if (!issue.assignee || !issue.project || !issue.completedAt) {
      unmappedCount++;
      continue;
    }

    const customerId = projectToCustomer.get(issue.project.id);
    const teamMemberId = userToMember.get(issue.assignee.id);
    if (!customerId || !teamMemberId) {
      unmappedCount++;
      continue;
    }

    const completedDate = new Date(issue.completedAt);
    const weekNum = getWeekNumberInMonth(completedDate, month);

    const key = `${teamMemberId}:${customerId}:${weekNum}`;
    ticketCounts.set(key, (ticketCounts.get(key) ?? 0) + 1);

    const totalKey = `${teamMemberId}:${weekNum}`;
    memberWeekTotals.set(totalKey, (memberWeekTotals.get(totalKey) ?? 0) + 1);
  }

  // Convert to percentages
  const allocations: AllocationEntry[] = [];
  for (const [key, count] of ticketCounts) {
    const [teamMemberId, customerId, weekStr] = key.split(":");
    const week = parseInt(weekStr);
    const totalKey = `${teamMemberId}:${week}`;
    const total = memberWeekTotals.get(totalKey) ?? 1;

    allocations.push({
      teamMemberId,
      customerId,
      month,
      week,
      percentage: Math.round((count / total) * 100 * 10) / 10,
    });
  }

  return { allocations, unmappedCount };
}

async function persistLinearAllocations(
  allocations: AllocationEntry[],
  month: string
): Promise<void> {
  // Find manual overrides to preserve
  const manualOverrides = await db.timeAllocation.findMany({
    where: { month, source: "manual" },
    select: { teamMemberId: true, customerId: true, week: true },
  });
  const manualKeys = new Set(
    manualOverrides.map(
      (o) => `${o.teamMemberId}:${o.customerId}:${o.week}`
    )
  );

  // Replace linear-sourced allocations
  await db.timeAllocation.deleteMany({
    where: { month, source: "linear" },
  });

  for (const alloc of allocations) {
    const key = `${alloc.teamMemberId}:${alloc.customerId}:${alloc.week}`;
    if (manualKeys.has(key)) continue;

    await db.timeAllocation.create({
      data: {
        teamMemberId: alloc.teamMemberId,
        customerId: alloc.customerId,
        month: alloc.month,
        week: alloc.week,
        percentage: alloc.percentage,
        source: "linear",
      },
    });
  }
}

/**
 * Compute monthly aggregate allocations from weekly data.
 * Monthly percentage = average of weekly percentages across all weeks in the month.
 */
export async function getMonthlyAggregateAllocations(month: string) {
  const weeks = getWeeksInMonth(month);
  const weekCount = weeks.length;

  const allocations = await db.timeAllocation.findMany({
    where: { month },
    include: { teamMember: true },
  });

  const grouped = new Map<
    string,
    {
      teamMemberId: string;
      customerId: string;
      totalPercentage: number;
      monthlyCost: number;
    }
  >();

  for (const alloc of allocations) {
    const key = `${alloc.teamMemberId}:${alloc.customerId}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.totalPercentage += alloc.percentage;
    } else {
      grouped.set(key, {
        teamMemberId: alloc.teamMemberId,
        customerId: alloc.customerId,
        totalPercentage: alloc.percentage,
        monthlyCost: alloc.teamMember.monthlyCost ?? 0,
      });
    }
  }

  return Array.from(grouped.values()).map((g) => ({
    teamMemberId: g.teamMemberId,
    customerId: g.customerId,
    percentage: g.totalPercentage / weekCount,
    monthlyCost: g.monthlyCost,
  }));
}
