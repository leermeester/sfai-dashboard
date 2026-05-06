import { select, multiselect, text, log, spinner, isCancel } from "@clack/prompts";
import { authHeaders } from "../auth.js";

// ── Constants ────────────────────────────────────────

const FIBONACCI_WEIGHTS = [1, 2, 3, 5, 8, 13, 21, 34] as const;

// ── Types ────────────────────────────────────────────

interface AllocationEntry {
  teamMemberId: string;
  teamMemberName: string;
  customerId: string;
  customerName: string;
  weight: number;
}

interface TeamMemberOption {
  id: string;
  name: string;
}

interface CustomerOption {
  id: string;
  displayName: string;
}

// ── Helpers ──────────────────────────────────────────

function renderWeight(weight: number, barWidth = 16): string {
  const ratio = weight / 34;
  const filled = Math.round(ratio * barWidth);
  return "\u2588".repeat(filled) + "\u2591".repeat(barWidth - filled);
}

function formatMonthLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatMonth(d: Date): string {
  return d.toISOString().slice(0, 7);
}

// ── Main command ─────────────────────────────────────

export async function allocate(baseUrl: string, _flags: string[], token: string) {
  // Step 1: Select month
  const month = await selectMonth();
  if (!month) return;

  // Step 2: Load existing data
  const s = spinner();
  s.start("Loading allocation data...");

  const [allocRes, teamRes, custRes] = await Promise.all([
    fetch(`${baseUrl}/api/allocate?month=${month}`, { headers: authHeaders(token) }),
    fetch(`${baseUrl}/api/settings/team`, { headers: authHeaders(token) }).catch(() => null),
    fetch(`${baseUrl}/api/settings/customers`, { headers: authHeaders(token) }).catch(() => null),
  ]);

  if (!allocRes.ok) {
    s.stop(`Failed: ${allocRes.status}`);
    return;
  }

  const allocData = await allocRes.json();
  const existing: AllocationEntry[] = (allocData.allocations || []).map((a: { teamMemberId: string; teamMemberName: string; customerId: string; customerName: string; weight: number }) => ({
    teamMemberId: a.teamMemberId,
    teamMemberName: a.teamMemberName,
    customerId: a.customerId,
    customerName: a.customerName,
    weight: a.weight,
  }));

  let teamMembers: TeamMemberOption[] = [];
  let customers: CustomerOption[] = [];

  if (teamRes?.ok) {
    const teamData = await teamRes.json();
    teamMembers = teamData.members || teamData || [];
  }
  if (custRes?.ok) {
    const custData = await custRes.json();
    customers = custData.customers || [];
  }

  s.stop("Data loaded");

  // Step 2b: Show existing allocations if any
  let working: AllocationEntry[] = [];

  if (existing.length > 0) {
    log.step("");
    log.message(`Existing allocations for ${month}:`);
    displayAllocations(existing);

    const action = await select({
      message: "What would you like to do?",
      options: [
        { value: "edit", label: "Edit existing" },
        { value: "fresh", label: "Start fresh" },
        { value: "exit", label: "Exit" },
      ],
    });
    if (isCancel(action) || action === "exit") return;

    if (action === "edit") {
      working = [...existing];
    }
    // "fresh" leaves working as empty array
  }

  // Step 3: Multi-select team members
  const memberOptions = teamMembers.map((m) => {
    const hasExisting = working.some((a) => a.teamMemberId === m.id);
    return { value: m.id, label: m.name, hint: hasExisting ? "has allocations" : undefined };
  });

  if (memberOptions.length === 0) {
    log.warning("No team members found. Configure team members in Settings first.");
    return;
  }

  const selectedMembers = await multiselect({
    message: "Select team members to plan (space to select, enter to confirm)",
    options: memberOptions,
    required: true,
  });
  if (isCancel(selectedMembers)) return;

  const memberIds = selectedMembers as string[];

  // Step 4-5: For each member, select customers and assign weights
  for (const memberId of memberIds) {
    const member = teamMembers.find((m) => m.id === memberId);
    if (!member) continue;

    log.step("");
    log.message(`\u2500\u2500 Planning for ${member.name} \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`);

    const existingForMember = working.filter((a) => a.teamMemberId === memberId);
    const existingCustomerIds = new Set(existingForMember.map((a) => a.customerId));

    // Customer multi-select
    const customerOptions = customers.map((c) => ({
      value: c.id,
      label: c.displayName,
      hint: existingCustomerIds.has(c.id)
        ? `weight: ${existingForMember.find((a) => a.customerId === c.id)?.weight}`
        : undefined,
    }));

    if (customerOptions.length === 0) {
      log.warning("No customers found. Configure customers in Settings first.");
      continue;
    }

    const selectedCustomers = await multiselect({
      message: `Which customers does ${member.name} work on?`,
      options: customerOptions,
      required: true,
    });
    if (isCancel(selectedCustomers)) return;

    const customerIds = selectedCustomers as string[];

    // Remove old allocations for this member
    working = working.filter((a) => a.teamMemberId !== memberId);

    // Assign weights per customer
    for (const customerId of customerIds) {
      const customer = customers.find((c) => c.id === customerId);
      if (!customer) continue;

      const existingWeight = existingForMember.find((a) => a.customerId === customerId)?.weight;

      const selectedWeight = await select({
        message: `Weight for ${member.name} \u2192 ${customer.displayName}?${existingWeight ? ` (current: ${existingWeight})` : ""}`,
        options: FIBONACCI_WEIGHTS.map((w) => ({
          value: w,
          label: `${String(w).padStart(2)}  ${renderWeight(w)}`,
        })),
        initialValue: existingWeight ?? 3,
      });
      if (isCancel(selectedWeight)) return;

      working.push({
        teamMemberId: memberId,
        teamMemberName: member.name,
        customerId,
        customerName: customer.displayName,
        weight: selectedWeight as number,
      });
    }
  }

  // Remove allocations for members not in the selection
  // (keep allocations for members that weren't selected this round)
  const selectedMemberSet = new Set(memberIds);
  const untouched = existing.filter((a) => !selectedMemberSet.has(a.teamMemberId));
  const final = [...untouched, ...working.filter((a) => selectedMemberSet.has(a.teamMemberId))];

  if (final.length === 0) {
    log.warning("No allocations to save.");
    return;
  }

  // Step 6: Review summary
  log.step("");
  log.message(`\u2500\u2500 Summary for ${month} \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`);
  displayAllocations(final);

  const reviewAction = await select({
    message: "Save this allocation plan?",
    options: [
      { value: "save", label: "Save" },
      { value: "exit", label: "Exit without saving" },
    ],
  });

  if (isCancel(reviewAction) || reviewAction === "exit") return;

  // Step 7: Save
  const saveSpin = spinner();
  saveSpin.start("Saving allocations...");

  const payload = {
    month,
    allocations: final.map((a) => ({
      teamMemberId: a.teamMemberId,
      customerId: a.customerId,
      weight: a.weight,
    })),
  };

  const res = await fetch(`${baseUrl}/api/allocate`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    saveSpin.stop(`Failed to save: ${res.status}`);
    const errBody = await res.text();
    log.error(errBody);
    return;
  }

  const result = await res.json();
  saveSpin.stop(`Allocation plan saved (${result.count} entries)`);
  log.success(`  ${month} capacity plan is set.`);
}

// ── Display helper ───────────────────────────────────

function displayAllocations(allocations: AllocationEntry[]) {
  // Group by team member
  const byMember = new Map<string, { name: string; entries: { customerName: string; weight: number }[] }>();

  for (const a of allocations) {
    const group = byMember.get(a.teamMemberId) || { name: a.teamMemberName, entries: [] };
    group.entries.push({ customerName: a.customerName, weight: a.weight });
    byMember.set(a.teamMemberId, group);
  }

  log.step("");
  for (const [, member] of byMember) {
    const totalWeight = member.entries.reduce((sum, e) => sum + e.weight, 0);
    log.message(`  ${member.name}  (total: ${totalWeight})`);
    for (const e of member.entries) {
      log.message(`    ${e.customerName.padEnd(22)} ${renderWeight(e.weight, 12)} ${e.weight}`);
    }
  }
}

// ── Month selection ──────────────────────────────────

async function selectMonth(): Promise<string | null> {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthAfterNext = new Date(now.getFullYear(), now.getMonth() + 2, 1);

  const selected = await select({
    message: "Which month to plan?",
    options: [
      { value: formatMonth(nextMonth), label: `${formatMonthLabel(nextMonth)} (next month)` },
      { value: formatMonth(monthAfterNext), label: formatMonthLabel(monthAfterNext) },
      { value: formatMonth(currentMonth), label: `${formatMonthLabel(currentMonth)} (current)` },
      { value: "__other__", label: "Other (enter manually)" },
    ],
  });

  if (isCancel(selected)) return null;

  if (selected === "__other__") {
    const manual = await text({
      message: "Enter month (YYYY-MM):",
      validate: (v) => (/^\d{4}-\d{2}$/.test(v) ? undefined : "Format: YYYY-MM"),
    });
    if (isCancel(manual)) return null;
    return manual as string;
  }

  return selected as string;
}
