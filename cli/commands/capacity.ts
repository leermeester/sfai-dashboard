import { select, multiselect, text, log, spinner, isCancel, confirm } from "@clack/prompts";
import { authHeaders } from "../auth.js";

// ── Types ─────────────────────────────────────────────

interface CapacityStatusMember {
  id: string;
  name: string;
  weeklyHours: number;
  ticketsPerWeek: number;
  hasRateData: boolean;
  assignedTickets: number;
  weeksOfWork: number;
  customers: { id: string; name: string; tickets: number }[];
}

interface CapacityIssue {
  type: "overloaded" | "unassigned_demand" | "available";
  memberId?: string;
  memberName?: string;
  customerId?: string;
  customerName?: string;
  tickets?: number;
  weeksOfWork?: number;
  detail?: string;
}

interface CapacityStatusData {
  weekLabel: string;
  weekStart: string;
  team: {
    totalTicketCapacity: number;
    totalAssigned: number;
    members: CapacityStatusMember[];
  };
  issues: CapacityIssue[];
}

interface PlanMemberAccuracy {
  id: string;
  name: string;
  forecasted: number;
  actual: number;
}

interface DemandEstimate {
  teamMemberId: string;
  memberName: string;
  customerId: string;
  customerName: string;
  ticketCount: number;
}

interface PlanForecastEntry {
  customerId: string;
  customerName: string;
  teamMemberId: string | null;
  memberName: string | null;
  tickets: number;
  source: string;
  confidence: string | null;
  notes: string | null;
}

interface PlanGap {
  type: string;
  memberId?: string;
  memberName?: string;
  customerId?: string;
  customerName?: string;
  tickets?: number;
  weeksOfWork?: number;
}

interface ThroughputEntry {
  ticketsPerWeek: number;
  hasData: boolean;
  completedTickets: number | null;
  billedHours: number | null;
  month: string | null;
}

interface CapacityPlanData {
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
    gaps: PlanGap[];
  };
  throughput: Record<string, ThroughputEntry>;
  weeks: string[];
}

interface CustomerOption {
  id: string;
  displayName: string;
}

interface TeamMemberOption {
  id: string;
  name: string;
}

// ── Helpers ───────────────────────────────────────────

function renderBar(ratio: number, width = 10): string {
  const clamped = Math.min(ratio, 1);
  const filled = Math.round(clamped * width);
  return "\u2588".repeat(filled) + "\u2591".repeat(width - filled);
}

function formatWeekShort(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Main command ──────────────────────────────────────

export async function capacity(baseUrl: string, flags: string[], token: string) {
  const subcommand = flags[0];

  switch (subcommand) {
    case "plan":
      await capacityPlan(baseUrl, token);
      break;
    case "detail":
      await capacityDetail(baseUrl, token);
      break;
    case "throughput":
      await capacityThroughput(baseUrl, token);
      break;
    default:
      await capacityStatus(baseUrl, token);
      break;
  }
}

// ── Status view ───────────────────────────────────────

async function capacityStatus(baseUrl: string, token: string) {
  const s = spinner();
  s.start("Loading capacity data...");

  const res = await fetch(`${baseUrl}/api/capacity/status`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    s.stop(`Failed: ${res.status}`);
    return;
  }

  const data: CapacityStatusData = await res.json();
  s.stop("Capacity data loaded");

  // Header
  log.step("");
  log.message(`SFAI Capacity \u2014 ${data.weekLabel}`);
  log.step("");

  // Per-member breakdown
  if (data.team.members.length > 0) {
    for (const m of data.team.members) {
      const ratio = m.ticketsPerWeek > 0 ? m.assignedTickets / m.ticketsPerWeek : 0;
      const bar = renderBar(ratio);
      const rateLabel = m.hasRateData ? `${m.ticketsPerWeek}/wk` : `${m.ticketsPerWeek}/wk*`;
      const workLabel = m.assignedTickets > 0
        ? `~${m.weeksOfWork} wks work`
        : "available";
      log.message(`  ${m.name.padEnd(18)} ${bar} ${String(m.assignedTickets).padStart(3)} tickets | ${rateLabel} cap | ${workLabel}`);
      for (const c of m.customers) {
        log.message(`    ${c.name.padEnd(20)} ${c.tickets} tickets`);
      }
    }

    // Members with no tickets
    const idle = data.team.members.filter((m) => m.assignedTickets === 0);
    if (idle.length > 0) {
      for (const m of idle) {
        const rateLabel = m.hasRateData ? `${m.ticketsPerWeek}/wk` : `${m.ticketsPerWeek}/wk*`;
        log.message(`  ${m.name.padEnd(18)} ${renderBar(0)} ${String(0).padStart(3)} tickets | ${rateLabel} cap | available`);
      }
    }
  } else {
    log.message("  No forecasts yet.");
  }

  // Issues
  if (data.issues.length > 0) {
    log.step("");
    for (const issue of data.issues) {
      switch (issue.type) {
        case "overloaded":
          log.warning(`  ${issue.memberName}: ${issue.weeksOfWork} weeks of work queued (${issue.detail})`);
          break;
        case "unassigned_demand":
          log.warning(`  ${issue.customerName} has ${issue.tickets} tickets, no one assigned`);
          break;
        case "available":
          log.info(`  ${issue.memberName}: no tickets assigned`);
          break;
      }
    }
  }

  // Note about asterisk
  const hasEstimated = data.team.members.some((m) => !m.hasRateData);
  if (hasEstimated) {
    log.step("");
    log.info("  * = estimated rate (run `sfai capacity throughput` to set actual rates)");
  }

  // Action menu
  log.step("");
  const action = await select({
    message: "What would you like to do?",
    options: [
      { value: "plan", label: "Plan \u2014 update forecasts" },
      { value: "detail", label: "Detail \u2014 full 4-week breakdown" },
      { value: "throughput", label: "Throughput \u2014 view/update engineer rates" },
      { value: "exit", label: "Exit" },
    ],
  });

  if (isCancel(action) || action === "exit") return;

  if (action === "plan") {
    await capacityPlan(baseUrl, token);
  } else if (action === "detail") {
    await capacityDetail(baseUrl, token);
  } else if (action === "throughput") {
    await capacityThroughput(baseUrl, token);
  }
}

// ── Plan flow ─────────────────────────────────────────

async function capacityPlan(baseUrl: string, token: string) {
  const s = spinner();
  s.start("Loading plan data + Linear tickets...");

  const [planRes, custRes, teamRes] = await Promise.all([
    fetch(`${baseUrl}/api/capacity/plan`, { headers: authHeaders(token) }),
    fetch(`${baseUrl}/api/settings/customers`, { headers: authHeaders(token) }).catch(() => null),
    fetch(`${baseUrl}/api/settings/team`, { headers: authHeaders(token) }).catch(() => null),
  ]);

  if (!planRes.ok) {
    s.stop(`Failed: ${planRes.status}`);
    return;
  }

  const plan: CapacityPlanData = await planRes.json();
  let customers: CustomerOption[] = [];
  let teamMembers: TeamMemberOption[] = [];

  if (custRes?.ok) {
    const custData = await custRes.json();
    customers = custData.customers || [];
  }
  if (teamRes?.ok) {
    const teamData = await teamRes.json();
    teamMembers = teamData.members || teamData || [];
  }

  s.stop("Plan data loaded");

  // ── Last week accuracy ──
  if (plan.lastWeek) {
    const lw = plan.lastWeek;
    log.step("");
    log.message(`\u2500\u2500 Last Week Accuracy \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`);
    log.message(
      `  Forecasted: ${lw.forecastedTotal} tickets | Actual: ${lw.actualTotal} tickets | ${lw.accuracy}% accurate`
    );
    if (lw.members.length > 0) {
      const memberLine = lw.members
        .map((m) => `${m.name.split(" ")[0]}: ${m.forecasted}\u2192${m.actual}`)
        .join("  ");
      log.message(`  ${memberLine}`);
    }
  }

  // ── This week auto-fill ──
  log.step("");
  log.message(`\u2500\u2500 This Week (${formatWeekShort(plan.thisWeek.weekStart)}) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`);

  // Build the working forecast: start from existing, merge in Linear suggestions
  const workingForecasts = buildWorkingForecasts(plan);

  // Display per-member summary
  displayWorkingPlan(workingForecasts, plan.throughput);

  // Gaps
  if (plan.thisWeek.gaps.length > 0) {
    log.step("");
    for (const gap of plan.thisWeek.gaps) {
      if (gap.type === "unallocated") {
        log.warning(`  ${gap.memberName} has no tickets assigned`);
      } else if (gap.type === "overloaded") {
        log.warning(`  ${gap.memberName} has ${gap.tickets} tickets (~${gap.weeksOfWork} wks work)`);
      } else if (gap.type === "missing_customer") {
        log.warning(`  No forecast for ${gap.customerName} (had ${gap.tickets} tickets last week)`);
      }
    }
  }

  // Action loop
  let done = false;
  while (!done) {
    log.step("");
    const options = [
      { value: "adjust", label: "Adjust \u2014 add/edit a forecast" },
      ...(workingForecasts.length > 0
        ? [{ value: "remove", label: "Remove \u2014 delete a forecast entry" }]
        : []),
      { value: "notes", label: "Notes \u2014 add a note (use dictation)" },
      { value: "confirm", label: "Confirm \u2014 save this week's plan" },
      { value: "exit", label: "Exit without saving" },
    ];

    const action = await select({ message: "What next?", options });

    if (isCancel(action) || action === "exit") {
      done = true;
      break;
    }

    if (action === "adjust") {
      await adjustForecast(workingForecasts, customers, teamMembers, plan);
      displayWorkingPlan(workingForecasts, plan.throughput);
    } else if (action === "remove") {
      await removeForecast(workingForecasts);
      displayWorkingPlan(workingForecasts, plan.throughput);
    } else if (action === "notes") {
      await addNotes(workingForecasts);
    } else if (action === "confirm") {
      await confirmWeek(baseUrl, token, plan.thisWeek.weekStart, workingForecasts);
      done = true;
    }
  }
}

interface WorkingForecast {
  customerId: string;
  customerName: string;
  teamMemberId: string | null;
  memberName: string | null;
  tickets: number;
  confidence: string;
  notes: string | null;
  source: string;
}

function buildWorkingForecasts(plan: CapacityPlanData): WorkingForecast[] {
  const forecasts: WorkingForecast[] = [];
  const existingKeys = new Set<string>();

  // Start with existing forecasts
  for (const f of plan.thisWeek.forecasts) {
    const key = `${f.customerId}:${f.teamMemberId || ""}`;
    existingKeys.add(key);
    forecasts.push({
      customerId: f.customerId,
      customerName: f.customerName,
      teamMemberId: f.teamMemberId,
      memberName: f.memberName,
      tickets: f.tickets,
      confidence: f.confidence || "medium",
      notes: f.notes,
      source: f.source,
    });
  }

  // Merge in Linear suggestions for entries that don't exist yet
  for (const ls of plan.thisWeek.linearSuggestions) {
    const key = `${ls.customerId}:${ls.teamMemberId}`;
    if (!existingKeys.has(key)) {
      forecasts.push({
        customerId: ls.customerId,
        customerName: ls.customerName,
        teamMemberId: ls.teamMemberId,
        memberName: ls.memberName,
        tickets: ls.ticketCount,
        confidence: "medium",
        notes: `Linear: ${ls.ticketCount} open tickets (<30d)`,
        source: "linear",
      });
    }
  }

  return forecasts;
}

function displayWorkingPlan(forecasts: WorkingForecast[], throughput?: Record<string, ThroughputEntry>) {
  if (forecasts.length === 0) {
    log.message("  (no forecasts yet)");
    return;
  }

  const memberTotals = new Map<string, { name: string; tickets: number; custs: string[] }>();
  for (const f of forecasts) {
    const key = f.teamMemberId || "__unassigned__";
    const name = f.memberName || "Unassigned";
    const entry = memberTotals.get(key) || { name, tickets: 0, custs: [] };
    entry.tickets += f.tickets;
    entry.custs.push(`${f.customerName} ${f.tickets}`);
    memberTotals.set(key, entry);
  }

  log.step("");
  log.message("  Current plan:");
  for (const [memberId, m] of memberTotals) {
    const rate = throughput && memberId !== "__unassigned__" ? throughput[memberId] : null;
    const capLabel = rate ? ` / ${rate.ticketsPerWeek} cap` : "";
    log.message(`  ${m.name} \u2192 ${m.custs.join(", ")}     [${m.tickets} tickets${capLabel}]`);
  }
}

async function removeForecast(forecasts: WorkingForecast[]) {
  if (forecasts.length === 0) {
    log.warning("No forecasts to remove.");
    return;
  }

  const options = forecasts.map((f, i) => ({
    value: String(i),
    label: `${f.memberName || "Unassigned"} \u2192 ${f.customerName} (${f.tickets} tickets)`,
  }));

  const selectedIdx = await select({
    message: "Which forecast to remove?",
    options,
  });
  if (isCancel(selectedIdx)) return;

  const idx = parseInt(selectedIdx as string);
  const removed = forecasts.splice(idx, 1)[0];
  log.success(`  Removed: ${removed.memberName || "Unassigned"} \u2192 ${removed.customerName} ${removed.tickets} tickets`);
}

async function adjustForecast(
  forecasts: WorkingForecast[],
  customers: CustomerOption[],
  teamMembers: TeamMemberOption[],
  plan: CapacityPlanData
) {
  // Pick customer
  const customerOptions = customers.length > 0
    ? customers.map((c) => ({ value: c.id, label: c.displayName }))
    : [{ value: "__manual__", label: "Enter customer ID manually" }];

  const selectedCustomer = await select({
    message: "Which customer?",
    options: customerOptions,
  });
  if (isCancel(selectedCustomer)) return;

  const customerId = selectedCustomer as string;
  const customerName = customers.find((c) => c.id === customerId)?.displayName || customerId;

  // Pick team members (multiselect — space to toggle, enter to confirm)
  const memberOptions = teamMembers.length > 0
    ? [
        ...teamMembers.map((m) => {
          const rate = plan.throughput[m.id];
          const rateHint = rate ? ` (${rate.ticketsPerWeek}/wk)` : "";
          return { value: m.id, label: `${m.name}${rateHint}` };
        }),
        { value: "__none__", label: "Unassigned" },
      ]
    : [{ value: "__none__", label: "Unassigned" }];

  const selectedMembers = await multiselect({
    message: "Who's working on it? (space to select, enter to confirm)",
    options: memberOptions,
    required: true,
  });
  if (isCancel(selectedMembers)) return;

  const memberIds = (selectedMembers as string[]).map((id) =>
    id === "__none__" ? null : id
  );

  // Ask tickets + confidence per selected member
  const entries: { teamMemberId: string | null; memberName: string | null; tickets: number }[] = [];

  for (const teamMemberId of memberIds) {
    const memberName = teamMemberId
      ? teamMembers.find((m) => m.id === teamMemberId)?.name || teamMemberId
      : "Unassigned";

    const existing = forecasts.find(
      (f) => f.customerId === customerId && f.teamMemberId === teamMemberId
    );
    const linearSuggestion = plan.thisWeek.linearSuggestions.find(
      (ls) => ls.customerId === customerId && ls.teamMemberId === teamMemberId
    );
    const hint = linearSuggestion
      ? ` (Linear: ${linearSuggestion.ticketCount} open)`
      : existing
      ? ` (current: ${existing.tickets})`
      : "";

    const ticketInput = await text({
      message: `Tickets for ${memberName}?${hint}`,
      placeholder: existing ? String(existing.tickets) : "0",
      validate: (v) => {
        const n = parseFloat(v);
        if (isNaN(n) || n < 0) return "Enter a valid number";
        return undefined;
      },
    });
    if (isCancel(ticketInput)) return;

    entries.push({
      teamMemberId,
      memberName: teamMemberId ? memberName : null,
      tickets: parseFloat(ticketInput as string),
    });
  }

  // Confidence (shared across all entries)
  const confidence = await select({
    message: "Confidence?",
    options: [
      { value: "medium", label: "Medium (default)" },
      { value: "high", label: "High" },
      { value: "low", label: "Low" },
    ],
  });
  if (isCancel(confidence)) return;

  // Notes
  const notesInput = await text({
    message: "Notes? (enter to skip)",
    placeholder: "Press enter to skip",
    defaultValue: "",
  });
  const notes = isCancel(notesInput) ? null : (notesInput as string) || null;

  // Review before committing
  log.step("");
  for (const e of entries) {
    log.message(`  ${e.memberName || "Unassigned"} → ${customerName} ${e.tickets} tickets [${confidence}]${notes ? ` "${notes}"` : ""}`);
  }

  const reviewAction = await select({
    message: "Look good?",
    options: [
      { value: "save", label: "Save" },
      { value: "redo", label: "Start over" },
      { value: "cancel", label: "Cancel" },
    ],
  });

  if (isCancel(reviewAction) || reviewAction === "cancel") return;

  if (reviewAction === "redo") {
    await adjustForecast(forecasts, customers, teamMembers, plan);
    return;
  }

  // Commit all entries to working forecasts
  for (const e of entries) {
    const existing = forecasts.find(
      (f) => f.customerId === customerId && f.teamMemberId === e.teamMemberId
    );
    if (existing) {
      existing.tickets = e.tickets;
      existing.confidence = confidence as string;
      existing.notes = notes;
      existing.source = "manual";
    } else {
      forecasts.push({
        customerId,
        customerName,
        teamMemberId: e.teamMemberId,
        memberName: e.memberName,
        tickets: e.tickets,
        confidence: confidence as string,
        notes,
        source: "manual",
      });
    }
    log.success(`  Saved: ${e.memberName || "Unassigned"} → ${customerName} ${e.tickets} tickets`);
  }
}

async function addNotes(forecasts: WorkingForecast[]) {
  if (forecasts.length === 0) {
    log.warning("No forecasts to annotate yet.");
    return;
  }

  const options = forecasts.map((f, i) => ({
    value: String(i),
    label: `${f.memberName || "Unassigned"} \u2192 ${f.customerName} (${f.tickets} tickets)`,
  }));

  const selectedIdx = await select({
    message: "Which forecast to annotate?",
    options,
  });
  if (isCancel(selectedIdx)) return;

  const idx = parseInt(selectedIdx as string);
  const forecast = forecasts[idx];

  const notesInput = await text({
    message: `Notes for ${forecast.memberName || "Unassigned"} \u2192 ${forecast.customerName}:`,
    placeholder: forecast.notes || "Dictate your notes here...",
    defaultValue: forecast.notes || "",
  });
  if (isCancel(notesInput)) return;

  forecast.notes = (notesInput as string) || null;
  log.success("  Note saved.");
}

async function confirmWeek(
  baseUrl: string,
  token: string,
  weekStart: string,
  forecasts: WorkingForecast[]
) {
  if (forecasts.length === 0) {
    log.warning("No forecasts to save.");
    return;
  }

  const s = spinner();
  s.start("Saving plan...");

  const payload = {
    weekStart,
    forecasts: forecasts.map((f) => ({
      customerId: f.customerId,
      teamMemberId: f.teamMemberId,
      ticketsNeeded: f.tickets,
      hoursNeeded: f.tickets, // keep for backwards compat
      confidence: f.confidence,
      notes: f.notes,
      source: f.source,
    })),
  };

  const res = await fetch(`${baseUrl}/api/capacity/confirm-week`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    s.stop(`Failed to save: ${res.status}`);
    const errBody = await res.text();
    log.error(errBody);
    return;
  }

  const result = await res.json();
  s.stop(`Plan saved (${result.count} forecasts)`);
  log.success("  This week's capacity plan is confirmed.");
}

// ── Throughput subcommand ─────────────────────────────

async function capacityThroughput(baseUrl: string, token: string) {
  const s = spinner();
  s.start("Loading throughput data...");

  const [tpRes, teamRes] = await Promise.all([
    fetch(`${baseUrl}/api/capacity/throughput`, { headers: authHeaders(token) }),
    fetch(`${baseUrl}/api/settings/team`, { headers: authHeaders(token) }).catch(() => null),
  ]);

  if (!tpRes.ok) {
    s.stop(`Failed: ${tpRes.status}`);
    return;
  }

  const tpData = await tpRes.json();
  const throughput: Record<string, { teamMemberId: string; memberName: string; weeklyHours: number; ticketsPerWeek: number; completedTickets: number | null; billedHours: number | null; month: string | null; hasData: boolean }> = tpData.throughput || {};

  let teamMembers: TeamMemberOption[] = [];
  if (teamRes?.ok) {
    const teamData = await teamRes.json();
    teamMembers = teamData.members || teamData || [];
  }

  s.stop("Throughput data loaded");

  log.step("");
  log.message("Engineer Throughput");
  log.step("");

  // Table header
  log.message(`  ${"Name".padEnd(18)} ${"Billed".padStart(8)} ${"Tickets".padStart(8)} ${"Rate".padStart(8)}`);
  log.message(`  ${"".padEnd(18)} ${"".padEnd(8, "-")} ${"".padEnd(8, "-")} ${"".padEnd(8, "-")}`);

  const entries = Object.values(throughput);
  entries.sort((a, b) => a.memberName.localeCompare(b.memberName));

  for (const entry of entries) {
    const billed = entry.billedHours != null ? `${entry.billedHours}h` : "--";
    const tickets = entry.completedTickets != null ? String(entry.completedTickets) : "--";
    const rate = entry.hasData ? `${entry.ticketsPerWeek}/wk` : `${entry.ticketsPerWeek}/wk*`;
    const month = entry.month ? ` (${entry.month})` : "";

    log.message(`  ${entry.memberName.padEnd(18)} ${billed.padStart(8)} ${tickets.padStart(8)} ${rate.padStart(8)}${month}`);
  }

  const hasEstimated = entries.some((e) => !e.hasData);
  if (hasEstimated) {
    log.step("");
    log.info("  * = estimated rate (no billed hours data yet)");
  }

  // Offer to update
  log.step("");
  const action = await select({
    message: "What would you like to do?",
    options: [
      { value: "update", label: "Update \u2014 enter billed hours for a month" },
      { value: "exit", label: "Exit" },
    ],
  });

  if (isCancel(action) || action === "exit") return;

  if (action === "update") {
    await updateThroughput(baseUrl, token, teamMembers);
  }
}

async function updateThroughput(baseUrl: string, token: string, teamMembers: TeamMemberOption[]) {
  // Ask for month
  const monthInput = await text({
    message: "Which month? (YYYY-MM)",
    placeholder: new Date().toISOString().slice(0, 7),
    validate: (v) => {
      if (!/^\d{4}-\d{2}$/.test(v)) return "Format: YYYY-MM";
      return undefined;
    },
  });
  if (isCancel(monthInput)) return;
  const month = monthInput as string;

  // Loop through team members
  for (const member of teamMembers) {
    const hoursInput = await text({
      message: `${member.name} \u2014 billed hours for ${month}?`,
      placeholder: "Enter hours or press enter to skip",
      defaultValue: "",
    });
    if (isCancel(hoursInput)) return;

    const hours = parseFloat(hoursInput as string);
    if (isNaN(hours) || hours <= 0) continue;

    const s = spinner();
    s.start(`Saving ${member.name}...`);

    const res = await fetch(`${baseUrl}/api/capacity/throughput`, {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify({
        teamMemberId: member.id,
        month,
        billedHours: hours,
      }),
    });

    if (res.ok) {
      s.stop(`  ${member.name}: ${hours}h saved`);
    } else {
      s.stop(`  ${member.name}: failed to save`);
    }
  }

  log.success("  Throughput data updated. Run `sfai capacity` to see updated rates.");
}

// ── Detail view ───────────────────────────────────────

async function capacityDetail(baseUrl: string, token: string) {
  const s = spinner();
  s.start("Loading 4-week breakdown...");

  const [statusRes, planRes] = await Promise.all([
    fetch(`${baseUrl}/api/capacity/status`, { headers: authHeaders(token) }),
    fetch(`${baseUrl}/api/capacity/plan`, { headers: authHeaders(token) }),
  ]);

  if (!statusRes.ok || !planRes.ok) {
    s.stop("Failed to load data");
    return;
  }

  const status: CapacityStatusData = await statusRes.json();
  const plan: CapacityPlanData = await planRes.json();
  s.stop("4-week data loaded");

  // Build week columns
  const weekDates = plan.weeks.map((w) => formatWeekShort(w));
  const colWidth = 8;

  log.step("");
  log.message(`SFAI Capacity \u2014 4-Week View (tickets)`);
  log.step("");

  // Header row
  const header = "".padEnd(20) + weekDates.map((w) => w.padStart(colWidth)).join("");
  log.message(`  ${header}`);
  log.message(`  ${"".padEnd(20)}${"--------".repeat(weekDates.length)}`);

  for (const member of status.team.members) {
    const weekTickets = plan.weeks.map((weekIso) => {
      if (weekIso === plan.thisWeek.weekStart) {
        const memberForecasts = plan.thisWeek.forecasts.filter(
          (f) => f.teamMemberId === member.id
        );
        const total = memberForecasts.reduce((a, f) => a + f.tickets, 0);
        return total > 0 ? String(total) : "--";
      }
      return "--";
    });

    const rate = plan.throughput[member.id];
    const capLabel = rate ? ` (${rate.ticketsPerWeek}/wk)` : "";

    const row =
      `${member.name}${capLabel}`.padEnd(20) +
      weekTickets.map((h) => h.padStart(colWidth)).join("");
    log.message(`  ${row}`);

    // Customer sub-rows for current week
    const memberForecasts = plan.thisWeek.forecasts.filter(
      (f) => f.teamMemberId === member.id
    );
    for (const f of memberForecasts) {
      const subRow =
        `  ${f.customerName}`.padEnd(20) +
        plan.weeks
          .map((weekIso) => {
            if (weekIso === plan.thisWeek.weekStart) {
              return String(f.tickets).padStart(colWidth);
            }
            return "--".padStart(colWidth);
          })
          .join("");
      log.message(`  ${subRow}`);
    }
  }

  // Totals row
  log.message(`  ${"".padEnd(20)}${"--------".repeat(weekDates.length)}`);
  const totalRow =
    "Total".padEnd(20) +
    plan.weeks
      .map((weekIso) => {
        if (weekIso === plan.thisWeek.weekStart) {
          const total = plan.thisWeek.forecasts.reduce((a, f) => a + f.tickets, 0);
          const cap = Math.round(status.team.totalTicketCapacity);
          return `${total}/${cap}`.padStart(colWidth);
        }
        return `--/${Math.round(status.team.totalTicketCapacity)}`.padStart(colWidth);
      })
      .join("");
  log.message(`  ${totalRow}`);
}
