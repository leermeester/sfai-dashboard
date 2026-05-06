import { db } from "./db";

// ── Founder capacity constants ─────────────────────────────
// Hard-coded: only 2 founders, DB storage would be over-engineering.

export const FOUNDER_CAPS: Record<string, number> = {
  DJ: 9,
  Arthur: 7,
};
export const COMBINED_CAP = 15;

// ── Types ──────────────────────────────────────────────────

export interface FounderClientData {
  customerId: string;
  customerName: string;
  assignedFounder: string; // founder name or "Both"
  revenue: number;
  margin: number;
  marginPercent: number;
  meetingCount: number;
  meetingMinutes: number;
}

export interface FounderSummary {
  id: string;
  name: string;
  cap: number;
  activeClientCount: number;
}

export interface ChurnCandidate {
  customerId: string;
  customerName: string;
  assignedFounder: string;
  currentRevenue: number;
  nextMonthRevenue: number;
  trend: "declining" | "ending";
}

export interface FounderCapacityData {
  month: string;
  founders: (FounderSummary & { clients: FounderClientData[] })[];
  combined: {
    cap: number;
    activeClientCount: number;
    totalRevenue: number;
    totalMargin: number;
  };
  churn: ChurnCandidate[];
  summary: {
    slotsAvailable: number;
    revenueAtRisk: number;
  };
  allClients: FounderClientData[];
}

// ── Helpers ────────────────────────────────────────────────

function getNextMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(year, m, 1); // m is already 0-indexed +1 = next month
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// ── Main computation ───────────────────────────────────────

export async function computeFounderPortfolio(
  month: string
): Promise<FounderCapacityData> {
  // 1. Get founders
  const founders = await db.teamMember.findMany({
    where: { role: "cofounder", isActive: true },
    orderBy: { name: "asc" },
  });
  const founderIds = founders.map((f) => f.id);
  const founderNameById = new Map(founders.map((f) => [f.id, f.name]));

  // 2. Get active customers with founder assignment
  const customers = await db.customer.findMany({
    where: { isActive: true },
    select: {
      id: true,
      displayName: true,
      primaryFounderId: true,
    },
  });

  // 3. Revenue snapshots for this month + next month
  const nextMonth = getNextMonth(month);
  const snapshots = await db.salesSnapshot.findMany({
    where: { month: { in: [month, nextMonth] } },
  });
  const revenueByCustomer = new Map<string, number>();
  const nextRevenueByCustomer = new Map<string, number>();
  for (const s of snapshots) {
    if (s.month === month) revenueByCustomer.set(s.customerId, s.amount);
    if (s.month === nextMonth) nextRevenueByCustomer.set(s.customerId, s.amount);
  }

  // 4. Margins for this month
  const margins = await db.monthlyMargin.findMany({
    where: { month },
  });
  const marginByCustomer = new Map(
    margins.map((m) => [m.customerId, { margin: m.margin, percent: m.marginPercent }])
  );

  // 5. Founder meetings for this month
  const monthStart = new Date(`${month}-01`);
  const nextMonthDate = new Date(monthStart);
  nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);

  const meetingAgg = await db.clientMeeting.groupBy({
    by: ["teamMemberId", "customerId"],
    where: {
      date: { gte: monthStart, lt: nextMonthDate },
      meetingType: "client",
      teamMemberId: { in: founderIds },
      customerId: { not: null },
    },
    _sum: { durationMinutes: true },
    _count: { _all: true },
  });

  // Build meeting lookup: founderId -> customerId -> { count, minutes }
  const meetingMap = new Map<string, Map<string, { count: number; minutes: number }>>();
  for (const row of meetingAgg) {
    if (!row.customerId) continue;
    const fMap = meetingMap.get(row.teamMemberId) || new Map();
    fMap.set(row.customerId, {
      count: row._count._all,
      minutes: row._sum.durationMinutes || 0,
    });
    meetingMap.set(row.teamMemberId, fMap);
  }

  // 6. Determine founder assignment for each customer
  function getFounderAssignment(customerId: string, primaryFounderId: string | null): string {
    // Explicit assignment takes priority
    if (primaryFounderId && founderNameById.has(primaryFounderId)) {
      return founderNameById.get(primaryFounderId)!;
    }
    // Infer from meetings
    const foundersWithMeetings = founders.filter((f) => {
      const fMeetings = meetingMap.get(f.id);
      return fMeetings?.has(customerId);
    });
    if (foundersWithMeetings.length === 0) return "Unassigned";
    if (foundersWithMeetings.length >= 2) return "Both";
    return founderNameById.get(foundersWithMeetings[0].id)!;
  }

  // 7. Build per-client data
  const allClients: FounderClientData[] = [];
  for (const c of customers) {
    const revenue = revenueByCustomer.get(c.id) ?? 0;
    const marginData = marginByCustomer.get(c.id);
    const assignment = getFounderAssignment(c.id, c.primaryFounderId);

    // Sum meetings across all founders for this client
    let totalMeetingCount = 0;
    let totalMeetingMinutes = 0;
    for (const f of founders) {
      const fMeetings = meetingMap.get(f.id)?.get(c.id);
      if (fMeetings) {
        totalMeetingCount += fMeetings.count;
        totalMeetingMinutes += fMeetings.minutes;
      }
    }

    // Only include clients that have revenue OR meetings with founders
    if (revenue === 0 && totalMeetingCount === 0) continue;

    allClients.push({
      customerId: c.id,
      customerName: c.displayName,
      assignedFounder: assignment,
      revenue,
      margin: marginData?.margin ?? 0,
      marginPercent: marginData?.percent ?? 0,
      meetingCount: totalMeetingCount,
      meetingMinutes: totalMeetingMinutes,
    });
  }

  // Sort by revenue descending
  allClients.sort((a, b) => b.revenue - a.revenue);

  // 8. Build per-founder summaries
  const founderData = founders.map((f) => {
    const name = f.name;
    const cap = FOUNDER_CAPS[name] ?? 7;
    const myClients = allClients.filter(
      (c) => c.assignedFounder === name || c.assignedFounder === "Both"
    );
    return {
      id: f.id,
      name,
      cap,
      activeClientCount: myClients.length,
      clients: myClients,
    };
  });

  // 9. Combined stats
  const uniqueActiveClients = new Set(allClients.map((c) => c.customerId));
  const totalRevenue = allClients.reduce((a, c) => a + c.revenue, 0);
  const totalMargin = allClients.reduce((a, c) => a + c.margin, 0);

  // 10. Churn detection: clients with >50% revenue decline next month
  const churn: ChurnCandidate[] = [];
  for (const client of allClients) {
    if (client.revenue <= 0) continue;
    const nextRev = nextRevenueByCustomer.get(client.customerId);
    // Only flag if we have next month data and it shows significant decline
    if (nextRev !== undefined && nextRev < client.revenue * 0.5) {
      churn.push({
        customerId: client.customerId,
        customerName: client.customerName,
        assignedFounder: client.assignedFounder,
        currentRevenue: client.revenue,
        nextMonthRevenue: nextRev,
        trend: nextRev === 0 ? "ending" : "declining",
      });
    }
  }

  // 11. Summary
  const slotsUsed = uniqueActiveClients.size;
  const slotsFromChurn = churn.length;
  const slotsAvailable = COMBINED_CAP - slotsUsed + slotsFromChurn;
  const revenueAtRisk = churn.reduce((a, c) => a + c.currentRevenue, 0);

  return {
    month,
    founders: founderData,
    combined: {
      cap: COMBINED_CAP,
      activeClientCount: slotsUsed,
      totalRevenue,
      totalMargin,
    },
    churn,
    summary: {
      slotsAvailable,
      revenueAtRisk,
    },
    allClients,
  };
}
