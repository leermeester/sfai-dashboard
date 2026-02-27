import { startOfWeek, addWeeks, subWeeks, subDays, endOfWeek, startOfMonth, endOfMonth, format } from "date-fns";
import { db } from "./db";
import { getTeams, getActiveIssues, getCompletedIssues } from "./linear";
import { DEFAULT_WEEKLY_HOURS, DEFAULT_TICKETS_PER_WEEK } from "./capacity-config";

// ── Week computation ────────────────────────────────────────

/** Get the Monday 00:00 UTC of the current week. */
export function getCurrentWeekStart(): Date {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** Get rolling N-week window starting from the current week. */
export function getRollingWeeks(count = 4): Date[] {
  const start = getCurrentWeekStart();
  return Array.from({ length: count }, (_, i) => addWeeks(start, i));
}

/** Format a week start date for display: "Week of Feb 24" */
export function formatWeekLabel(weekStart: Date): string {
  return `Week of ${format(weekStart, "MMM d")}`;
}

// ── Engineer throughput ─────────────────────────────────────

export interface ThroughputRate {
  teamMemberId: string;
  memberName: string;
  weeklyHours: number;
  ticketsPerWeek: number;
  completedTickets: number | null;
  billedHours: number | null;
  month: string | null;
  hasData: boolean;
}

/**
 * Compute per-engineer throughput rates from the most recent
 * EngineerThroughput record + Linear completed ticket data.
 *
 * Formula: ticketsPerWeek = completedTickets / (billedHours / weeklyHours)
 */
export async function computeEngineerThroughput(): Promise<Map<string, ThroughputRate>> {
  const teamMembers = await db.teamMember.findMany({
    where: { isActive: true },
    select: { id: true, name: true, weeklyHours: true, linearUserId: true },
  });

  const result = new Map<string, ThroughputRate>();

  // Get the most recent throughput records for each member
  for (const member of teamMembers) {
    const latest = await db.engineerThroughput.findFirst({
      where: { teamMemberId: member.id },
      orderBy: { month: "desc" },
    });

    if (latest && latest.billedHours > 0) {
      // Auto-compute completed tickets from Linear if not yet set
      let completedTickets = latest.completedTickets;
      if (completedTickets === null && member.linearUserId) {
        completedTickets = await countCompletedTicketsForMonth(member.linearUserId, latest.month);
        // Cache it
        await db.engineerThroughput.update({
          where: { id: latest.id },
          data: { completedTickets },
        });
      }

      const effectiveWeeks = latest.billedHours / member.weeklyHours;
      const ticketsPerWeek = completedTickets && effectiveWeeks > 0
        ? completedTickets / effectiveWeeks
        : DEFAULT_TICKETS_PER_WEEK;

      result.set(member.id, {
        teamMemberId: member.id,
        memberName: member.name,
        weeklyHours: member.weeklyHours,
        ticketsPerWeek: Math.round(ticketsPerWeek * 10) / 10,
        completedTickets,
        billedHours: latest.billedHours,
        month: latest.month,
        hasData: true,
      });
    } else {
      // No throughput data — use fallback
      result.set(member.id, {
        teamMemberId: member.id,
        memberName: member.name,
        weeklyHours: member.weeklyHours,
        ticketsPerWeek: DEFAULT_TICKETS_PER_WEEK,
        completedTickets: null,
        billedHours: null,
        month: null,
        hasData: false,
      });
    }
  }

  return result;
}

/** Count completed tickets for a Linear user in a given month. */
async function countCompletedTicketsForMonth(linearUserId: string, month: string): Promise<number> {
  try {
    const [year, m] = month.split("-").map(Number);
    const monthStart = new Date(year, m - 1, 1);
    const monthEnd = endOfMonth(monthStart);

    const teams = await getTeams();
    const sfaiTeam = teams.find((t) => t.name.toLowerCase().includes("sfai"));
    if (!sfaiTeam) return 0;

    const issues = await getCompletedIssues(
      sfaiTeam.id,
      monthStart.toISOString(),
      monthEnd.toISOString()
    );

    return issues.filter((i) => i.assignee?.id === linearUserId).length;
  } catch {
    return 0;
  }
}

// ── Linear demand estimation (ticket-based) ─────────────────

export interface DemandEstimate {
  teamMemberId: string;
  memberName: string;
  customerId: string;
  customerName: string;
  ticketCount: number;
}

/**
 * Estimate demand from open Linear tickets (started/unstarted, <30 days old).
 * Groups by (assignee, project) and maps to (teamMember, customer).
 * Returns ticket counts — no hours conversion.
 */
export async function computeLinearDemandEstimate(): Promise<DemandEstimate[]> {
  try {
    const teams = await getTeams();
    const sfaiTeam = teams.find((t) => t.name.toLowerCase().includes("sfai"));
    if (!sfaiTeam) return [];

    const issues = await getActiveIssues(sfaiTeam.id);

    // Filter to tickets created within last 30 days
    const cutoff = subDays(new Date(), 30);
    const recentIssues = issues.filter((i) => new Date(i.createdAt) >= cutoff);

    // Build lookup maps
    const customers = await db.customer.findMany({
      where: { isActive: true, linearProjectId: { not: null } },
      select: { id: true, displayName: true, linearProjectId: true },
    });
    const projectToCustomer = new Map(
      customers.map((c) => [c.linearProjectId!, { id: c.id, name: c.displayName }])
    );

    const teamMembers = await db.teamMember.findMany({
      where: { isActive: true, linearUserId: { not: null } },
      select: { id: true, name: true, linearUserId: true },
    });
    const userToMember = new Map(
      teamMembers.map((m) => [m.linearUserId!, { id: m.id, name: m.name }])
    );

    // Group: (assigneeId, projectId) -> count
    const grouped = new Map<string, { member: { id: string; name: string }; customer: { id: string; name: string }; count: number }>();

    for (const issue of recentIssues) {
      if (!issue.assignee || !issue.project) continue;
      const member = userToMember.get(issue.assignee.id);
      const customer = projectToCustomer.get(issue.project.id);
      if (!member || !customer) continue;

      const key = `${member.id}:${customer.id}`;
      const entry = grouped.get(key);
      if (entry) {
        entry.count++;
      } else {
        grouped.set(key, { member, customer, count: 1 });
      }
    }

    return Array.from(grouped.values()).map((g) => ({
      teamMemberId: g.member.id,
      memberName: g.member.name,
      customerId: g.customer.id,
      customerName: g.customer.name,
      ticketCount: g.count,
    }));
  } catch {
    // Linear API unavailable — return empty suggestions
    return [];
  }
}

// ── Last-week actuals ───────────────────────────────────────

export interface WeekActual {
  teamMemberId: string;
  memberName: string;
  customerId: string;
  customerName: string;
  ticketCount: number;
}

/**
 * Compute actuals for a given week from completed Linear tickets.
 * Returns ticket counts.
 */
export async function computeWeekActuals(weekStart: Date): Promise<WeekActual[]> {
  try {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

    const teams = await getTeams();
    const sfaiTeam = teams.find((t) => t.name.toLowerCase().includes("sfai"));
    if (!sfaiTeam) return [];

    const issues = await getCompletedIssues(
      sfaiTeam.id,
      weekStart.toISOString(),
      weekEnd.toISOString()
    );

    // Build lookup maps
    const customers = await db.customer.findMany({
      where: { isActive: true, linearProjectId: { not: null } },
      select: { id: true, displayName: true, linearProjectId: true },
    });
    const projectToCustomer = new Map(
      customers.map((c) => [c.linearProjectId!, { id: c.id, name: c.displayName }])
    );

    const teamMembers = await db.teamMember.findMany({
      where: { isActive: true, linearUserId: { not: null } },
      select: { id: true, name: true, linearUserId: true },
    });
    const userToMember = new Map(
      teamMembers.map((m) => [m.linearUserId!, { id: m.id, name: m.name }])
    );

    const grouped = new Map<string, { member: { id: string; name: string }; customer: { id: string; name: string }; count: number }>();

    for (const issue of issues) {
      if (!issue.assignee || !issue.project) continue;
      const member = userToMember.get(issue.assignee.id);
      const customer = projectToCustomer.get(issue.project.id);
      if (!member || !customer) continue;

      const key = `${member.id}:${customer.id}`;
      const entry = grouped.get(key);
      if (entry) {
        entry.count++;
      } else {
        grouped.set(key, { member, customer, count: 1 });
      }
    }

    return Array.from(grouped.values()).map((g) => ({
      teamMemberId: g.member.id,
      memberName: g.member.name,
      customerId: g.customer.id,
      customerName: g.customer.name,
      ticketCount: g.count,
    }));
  } catch {
    // Linear API unavailable — return empty actuals
    return [];
  }
}

// ── Status computation (ticket-based) ───────────────────────

export interface CapacityStatusMember {
  id: string;
  name: string;
  weeklyHours: number;
  ticketsPerWeek: number;
  hasRateData: boolean;
  assignedTickets: number;
  weeksOfWork: number;
  customers: { id: string; name: string; tickets: number }[];
}

export interface CapacityIssue {
  type: "overloaded" | "unassigned_demand" | "available";
  memberId?: string;
  memberName?: string;
  customerId?: string;
  customerName?: string;
  tickets?: number;
  weeksOfWork?: number;
  detail?: string;
}

export interface CapacityStatus {
  weekLabel: string;
  weekStart: string;
  team: {
    totalTicketCapacity: number;
    totalAssigned: number;
    members: CapacityStatusMember[];
  };
  issues: CapacityIssue[];
}

export async function computeCapacityStatus(weekStart: Date): Promise<CapacityStatus> {
  const throughput = await computeEngineerThroughput();

  const customers = await db.customer.findMany({
    where: { isActive: true },
    select: { id: true, displayName: true },
  });
  const customerMap = new Map(customers.map((c) => [c.id, c.displayName]));

  const forecasts = await db.demandForecast.findMany({
    where: { weekStart },
  });

  // Aggregate tickets per member and per (member, customer)
  const memberForecasts = new Map<string, Map<string, number>>();
  const customerDemand = new Map<string, { total: number; assigned: boolean }>();

  for (const f of forecasts) {
    const tickets = f.ticketsNeeded ?? f.hoursNeeded; // fallback to hoursNeeded for legacy data
    if (f.teamMemberId) {
      const memberMap = memberForecasts.get(f.teamMemberId) || new Map<string, number>();
      memberMap.set(f.customerId, (memberMap.get(f.customerId) || 0) + tickets);
      memberForecasts.set(f.teamMemberId, memberMap);
    }

    const cd = customerDemand.get(f.customerId) || { total: 0, assigned: false };
    cd.total += tickets;
    if (f.teamMemberId) cd.assigned = true;
    customerDemand.set(f.customerId, cd);
  }

  const members: CapacityStatusMember[] = [];
  for (const [memberId, rate] of throughput) {
    const custMap = memberForecasts.get(memberId) || new Map();
    const assignedTickets = Array.from(custMap.values()).reduce((a, b) => a + b, 0);
    const weeksOfWork = rate.ticketsPerWeek > 0
      ? Math.round((assignedTickets / rate.ticketsPerWeek) * 10) / 10
      : 0;

    members.push({
      id: memberId,
      name: rate.memberName,
      weeklyHours: rate.weeklyHours,
      ticketsPerWeek: rate.ticketsPerWeek,
      hasRateData: rate.hasData,
      assignedTickets: Math.round(assignedTickets * 10) / 10,
      weeksOfWork,
      customers: Array.from(custMap.entries()).map(([cid, tix]) => ({
        id: cid,
        name: customerMap.get(cid) || cid,
        tickets: Math.round(tix * 10) / 10,
      })),
    });
  }

  const totalTicketCapacity = members.reduce((a, m) => a + m.ticketsPerWeek, 0);
  const totalAssigned = members.reduce((a, m) => a + m.assignedTickets, 0);

  // Identify issues
  const issues: CapacityIssue[] = [];

  for (const m of members) {
    if (m.weeksOfWork > 1.5) {
      const detail = m.customers.map((c) => `${c.name} ${c.tickets}`).join(" + ");
      issues.push({
        type: "overloaded",
        memberId: m.id,
        memberName: m.name,
        tickets: m.assignedTickets,
        weeksOfWork: m.weeksOfWork,
        detail,
      });
    }
    if (m.assignedTickets === 0) {
      issues.push({
        type: "available",
        memberId: m.id,
        memberName: m.name,
      });
    }
  }

  for (const [cid, demand] of customerDemand) {
    if (!demand.assigned && demand.total > 0) {
      issues.push({
        type: "unassigned_demand",
        customerId: cid,
        customerName: customerMap.get(cid) || cid,
        tickets: demand.total,
      });
    }
  }

  return {
    weekLabel: formatWeekLabel(weekStart),
    weekStart: weekStart.toISOString(),
    team: {
      totalTicketCapacity: Math.round(totalTicketCapacity * 10) / 10,
      totalAssigned: Math.round(totalAssigned * 10) / 10,
      members: members.sort((a, b) => b.assignedTickets - a.assignedTickets),
    },
    issues,
  };
}

// ── Plan computation (ticket-based) ─────────────────────────

export interface PlanForecastEntry {
  customerId: string;
  customerName: string;
  teamMemberId: string | null;
  memberName: string | null;
  tickets: number;
  source: string;
  confidence: string | null;
  notes: string | null;
}

export interface PlanMemberAccuracy {
  id: string;
  name: string;
  forecasted: number;
  actual: number;
}

export interface CapacityPlan {
  lastWeek: {
    weekStart: string;
    forecastedTotal: number;
    actualTotal: number;
    accuracy: number;
    members: PlanMemberAccuracy[];
  } | null;
  thisWeek: {
    weekStart: string;
    forecasts: PlanForecastEntry[];
    linearSuggestions: DemandEstimate[];
    gaps: { type: string; memberId?: string; memberName?: string; customerId?: string; customerName?: string; tickets?: number; weeksOfWork?: number }[];
  };
  throughput: Record<string, { ticketsPerWeek: number; hasData: boolean; completedTickets: number | null; billedHours: number | null; month: string | null }>;
  weeks: string[];
}

export async function computeCapacityPlan(): Promise<CapacityPlan> {
  const currentWeek = getCurrentWeekStart();
  const lastWeek = subWeeks(currentWeek, 1);
  const weeks = getRollingWeeks(4).map((w) => w.toISOString());

  const teamMembers = await db.teamMember.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });
  const memberMap = new Map(teamMembers.map((m) => [m.id, m.name]));

  const customers = await db.customer.findMany({
    where: { isActive: true },
    select: { id: true, displayName: true },
  });
  const customerMap = new Map(customers.map((c) => [c.id, c.displayName]));

  const throughputMap = await computeEngineerThroughput();

  // Last week accuracy (in tickets)
  let lastWeekData: CapacityPlan["lastWeek"] = null;
  const lastWeekForecasts = await db.demandForecast.findMany({
    where: { weekStart: lastWeek },
  });

  if (lastWeekForecasts.length > 0) {
    const actuals = await computeWeekActuals(lastWeek);

    // Aggregate forecasts by member (in tickets)
    const forecastByMember = new Map<string, number>();
    for (const f of lastWeekForecasts) {
      if (f.teamMemberId) {
        const tickets = f.ticketsNeeded ?? f.hoursNeeded;
        forecastByMember.set(f.teamMemberId, (forecastByMember.get(f.teamMemberId) || 0) + tickets);
      }
    }

    // Aggregate actuals by member
    const actualByMember = new Map<string, number>();
    for (const a of actuals) {
      actualByMember.set(a.teamMemberId, (actualByMember.get(a.teamMemberId) || 0) + a.ticketCount);
    }

    const forecastedTotal = Array.from(forecastByMember.values()).reduce((a, b) => a + b, 0);
    const actualTotal = Array.from(actualByMember.values()).reduce((a, b) => a + b, 0);

    const memberIds = new Set([...forecastByMember.keys(), ...actualByMember.keys()]);
    const memberAccuracy: PlanMemberAccuracy[] = Array.from(memberIds).map((id) => ({
      id,
      name: memberMap.get(id) || id,
      forecasted: forecastByMember.get(id) || 0,
      actual: actualByMember.get(id) || 0,
    }));

    lastWeekData = {
      weekStart: lastWeek.toISOString(),
      forecastedTotal: Math.round(forecastedTotal),
      actualTotal: Math.round(actualTotal),
      accuracy: forecastedTotal > 0 ? Math.round((Math.min(actualTotal, forecastedTotal) / forecastedTotal) * 100) : 0,
      members: memberAccuracy,
    };
  }

  // This week: existing forecasts + Linear suggestions
  const thisWeekForecasts = await db.demandForecast.findMany({
    where: { weekStart: currentWeek },
  });

  const linearSuggestions = await computeLinearDemandEstimate();

  const forecasts: PlanForecastEntry[] = thisWeekForecasts.map((f) => ({
    customerId: f.customerId,
    customerName: customerMap.get(f.customerId) || f.customerId,
    teamMemberId: f.teamMemberId,
    memberName: f.teamMemberId ? memberMap.get(f.teamMemberId) || f.teamMemberId : null,
    tickets: f.ticketsNeeded ?? f.hoursNeeded,
    source: f.source,
    confidence: f.confidence,
    notes: f.notes,
  }));

  // Gaps: members with no tickets or overloaded
  const gaps: CapacityPlan["thisWeek"]["gaps"] = [];
  const memberAllocated = new Map<string, number>();
  for (const f of thisWeekForecasts) {
    if (f.teamMemberId) {
      const tickets = f.ticketsNeeded ?? f.hoursNeeded;
      memberAllocated.set(f.teamMemberId, (memberAllocated.get(f.teamMemberId) || 0) + tickets);
    }
  }

  for (const [memberId, rate] of throughputMap) {
    const allocated = memberAllocated.get(memberId) || 0;
    if (allocated === 0) {
      gaps.push({
        type: "unallocated",
        memberId,
        memberName: rate.memberName,
        tickets: 0,
      });
    } else if (rate.ticketsPerWeek > 0 && allocated / rate.ticketsPerWeek > 1.5) {
      gaps.push({
        type: "overloaded",
        memberId,
        memberName: rate.memberName,
        tickets: allocated,
        weeksOfWork: Math.round((allocated / rate.ticketsPerWeek) * 10) / 10,
      });
    }
  }

  // Customers that had demand last week but not this week
  const lastWeekCustomers = new Set(lastWeekForecasts.map((f) => f.customerId));
  const thisWeekCustomers = new Set(thisWeekForecasts.map((f) => f.customerId));
  for (const cid of lastWeekCustomers) {
    if (!thisWeekCustomers.has(cid)) {
      const lastTickets = lastWeekForecasts
        .filter((f) => f.customerId === cid)
        .reduce((a, f) => a + (f.ticketsNeeded ?? f.hoursNeeded), 0);
      gaps.push({
        type: "missing_customer",
        customerId: cid,
        customerName: customerMap.get(cid) || cid,
        tickets: lastTickets,
      });
    }
  }

  // Build throughput response
  const throughput: CapacityPlan["throughput"] = {};
  for (const [memberId, rate] of throughputMap) {
    throughput[memberId] = {
      ticketsPerWeek: rate.ticketsPerWeek,
      hasData: rate.hasData,
      completedTickets: rate.completedTickets,
      billedHours: rate.billedHours,
      month: rate.month,
    };
  }

  return {
    lastWeek: lastWeekData,
    thisWeek: {
      weekStart: currentWeek.toISOString(),
      forecasts,
      linearSuggestions,
      gaps,
    },
    throughput,
    weeks,
  };
}
