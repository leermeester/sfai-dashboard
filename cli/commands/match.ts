import { select, text, log, spinner, isCancel, confirm, multiselect } from "@clack/prompts";
import { authHeaders } from "../auth.js";

// ── Types ─────────────────────────────────────────────

interface ResolutionItem {
  id: string;
  type: string;
  sourceEntity: string;
  suggestedMatch: {
    id?: string;
    label?: string;
    confidence?: number;
  } | null;
  confidence: number;
  context: Record<string, unknown> | null;
}

interface CustomerOption {
  id: string;
  displayName: string;
}

interface UndoEntry {
  itemId: string;
  sourceEntity: string;
  type: string;
  action: string;
  description: string;
}

const typeEmoji: Record<string, string> = {
  customer_match: "💰",
  engineer_split: "🔧",
};

const typeLabel: Record<string, string> = {
  customer_match: "Transaction → Customer",
  engineer_split: "Labor → Engineer Split",
};

// ── Main match command ────────────────────────────────

export async function match(baseUrl: string, flags: string[], token: string) {
  const typeIdx = flags.indexOf("--type");
  const typeFilter = typeIdx !== -1 ? flags[typeIdx + 1] : undefined;
  const batchMode = flags.includes("--batch");
  const minConfidenceIdx = flags.indexOf("--min-confidence");
  const minConfidence = minConfidenceIdx !== -1 ? parseInt(flags[minConfidenceIdx + 1]) : undefined;

  // Fetch pending items
  const typeParam = typeFilter ? `&type=${typeFilter}` : "";
  const res = await fetch(`${baseUrl}/api/resolution?status=pending${typeParam}&limit=50`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  let items: ResolutionItem[] = data.items || [];

  if (minConfidence !== undefined) {
    items = items.filter((i) => i.confidence >= minConfidence);
  }

  if (items.length === 0) {
    log.success("All caught up — no pending items.");
    return;
  }

  // Pre-fetch customer list for alternative picker
  let customers: CustomerOption[] = [];
  try {
    const custRes = await fetch(`${baseUrl}/api/settings/customers`, {
      headers: authHeaders(token),
    });
    if (custRes.ok) {
      const custData = await custRes.json();
      customers = custData.customers || [];
    }
  } catch {
    // Non-fatal: alternative picker won't work
  }

  // Batch mode: group high-confidence items for bulk approval
  if (batchMode) {
    await runBatchMode(baseUrl, token, items, customers);
    return;
  }

  // Interactive mode: one-by-one with undo support
  const undoStack: UndoEntry[] = [];
  let resolved = 0;
  let skipped = 0;
  const total = items.length;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const emoji = typeEmoji[item.type] || "❓";
    const label = typeLabel[item.type] || item.type;

    // Progress counter
    log.step("");
    log.message(`[${i + 1}/${total}] ${emoji} ${label}`);
    log.message(`  Source: "${item.sourceEntity}"`);

    // Confidence bar
    const confBar = renderConfidenceBar(item.confidence);
    log.message(`  Confidence: ${confBar} ${item.confidence}%`);

    // Rich context
    renderContext(item);

    if (item.suggestedMatch?.label) {
      log.info(`  → Suggested: ${item.suggestedMatch.label}`);
    }

    // Build options based on type
    const options = buildOptions(item, customers.length > 0);

    const result = await select({
      message: "Action:",
      options,
    });

    if (isCancel(result)) {
      log.warning("Cancelled");
      showSessionSummary(resolved, skipped, total);
      return;
    }

    const decision = result as Record<string, unknown>;

    if (decision.action === "skip") {
      skipped++;
      log.info("  ⏭ Skipped");
      continue;
    }

    if (decision.action === "undo") {
      if (undoStack.length === 0) {
        log.warning("Nothing to undo");
        i--; // Re-show this item
        continue;
      }
      // For now, undo just tells the user what happened — full undo requires API support
      const last = undoStack.pop()!;
      log.warning(`Undo not yet wired to API. Last action: ${last.description}`);
      i--; // Re-show this item
      continue;
    }

    // Handle "pick alternative" flow for customer_match
    if (decision.action === "pick_alternative") {
      const picked = await pickAlternativeCustomer(customers, item.sourceEntity);
      if (picked === null) {
        i--; // Re-show this item
        continue;
      }
      decision.action = "approve";
      decision.customerId = picked;
    }

    const s = spinner();
    s.start("Resolving...");

    const resolveRes = await fetch(`${baseUrl}/api/resolution/${item.id}/resolve`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ ...decision, channel: "cli" }),
    });

    if (resolveRes.ok) {
      s.stop("Resolved ✓");
      resolved++;
      undoStack.push({
        itemId: item.id,
        sourceEntity: item.sourceEntity,
        type: item.type,
        action: String(decision.action),
        description: `${item.type}: "${item.sourceEntity}" → ${decision.action}`,
      });
    } else {
      const err = await resolveRes.json();
      s.stop(`Error: ${err.error}`);
    }
  }

  showSessionSummary(resolved, skipped, total);
}

// ── Batch mode ────────────────────────────────────────

async function runBatchMode(
  baseUrl: string,
  token: string,
  items: ResolutionItem[],
  customers: CustomerOption[]
) {
  // Split into high-confidence (80+) and low-confidence (<80)
  const highConfidence = items.filter((i) => i.confidence >= 80 && i.suggestedMatch);
  const lowConfidence = items.filter((i) => i.confidence < 80 || !i.suggestedMatch);

  if (highConfidence.length > 0) {
    log.step("");
    log.message(`📦 Batch: ${highConfidence.length} high-confidence items (≥80%)`);
    log.step("");

    for (const item of highConfidence) {
      const emoji = typeEmoji[item.type] || "❓";
      const confBar = renderConfidenceBar(item.confidence);
      log.message(`  ${emoji} "${item.sourceEntity}" → ${item.suggestedMatch?.label} ${confBar} ${item.confidence}%`);
    }

    log.step("");
    const batchAction = await select({
      message: `Approve all ${highConfidence.length} items?`,
      options: [
        { value: "approve_all", label: `Approve all ${highConfidence.length}` },
        { value: "review", label: "Review individually" },
        { value: "skip", label: "Skip batch" },
      ],
    });

    if (isCancel(batchAction)) {
      log.warning("Cancelled");
      return;
    }

    if (batchAction === "approve_all") {
      const s = spinner();
      s.start(`Approving ${highConfidence.length} items...`);
      let approved = 0;
      let failed = 0;

      for (const item of highConfidence) {
        const decision: Record<string, unknown> = { action: "approve", channel: "cli" };

        if (item.type === "customer_match") {
          decision.customerId = item.suggestedMatch?.id;
        }

        const res = await fetch(`${baseUrl}/api/resolution/${item.id}/resolve`, {
          method: "POST",
          headers: authHeaders(token),
          body: JSON.stringify(decision),
        });

        if (res.ok) approved++;
        else failed++;
      }

      s.stop(`Batch complete: ${approved} approved, ${failed} failed`);
    } else if (batchAction === "review") {
      // Fall through to individual review for high-confidence items
      for (const item of highConfidence) {
        await reviewSingleItem(baseUrl, token, item, customers);
      }
    }
  }

  if (lowConfidence.length > 0) {
    log.step("");
    log.message(`🔍 ${lowConfidence.length} items need individual review (< 80% confidence)`);

    for (const item of lowConfidence) {
      await reviewSingleItem(baseUrl, token, item, customers);
    }
  }
}

async function reviewSingleItem(
  baseUrl: string,
  token: string,
  item: ResolutionItem,
  customers: CustomerOption[]
) {
  const emoji = typeEmoji[item.type] || "❓";
  const label = typeLabel[item.type] || item.type;

  log.step("");
  log.message(`${emoji} ${label}`);
  log.message(`  Source: "${item.sourceEntity}"`);

  const confBar = renderConfidenceBar(item.confidence);
  log.message(`  Confidence: ${confBar} ${item.confidence}%`);
  renderContext(item);

  if (item.suggestedMatch?.label) {
    log.info(`  → Suggested: ${item.suggestedMatch.label}`);
  }

  const options = buildOptions(item, customers.length > 0);
  const result = await select({ message: "Action:", options });

  if (isCancel(result)) return;

  const decision = result as Record<string, unknown>;
  if (decision.action === "skip") {
    log.info("  ⏭ Skipped");
    return;
  }

  if (decision.action === "pick_alternative") {
    const picked = await pickAlternativeCustomer(customers, item.sourceEntity);
    if (picked === null) return;
    decision.action = "approve";
    decision.customerId = picked;
  }

  const s = spinner();
  s.start("Resolving...");

  const resolveRes = await fetch(`${baseUrl}/api/resolution/${item.id}/resolve`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ ...decision, channel: "cli" }),
  });

  if (resolveRes.ok) {
    s.stop("Resolved ✓");
  } else {
    const err = await resolveRes.json();
    s.stop(`Error: ${err.error}`);
  }
}

// ── Alternative customer picker ───────────────────────

async function pickAlternativeCustomer(
  customers: CustomerOption[],
  sourceEntity: string
): Promise<string | null> {
  if (customers.length === 0) {
    log.warning("No customer list available. Use the dashboard for alternative matches.");
    return null;
  }

  // Search/filter flow
  const searchTerm = await text({
    message: "Search customer (or Enter for full list):",
    placeholder: sourceEntity,
  });

  if (isCancel(searchTerm)) return null;

  const query = (searchTerm as string || "").toLowerCase();
  const filtered = query
    ? customers.filter((c) => c.displayName.toLowerCase().includes(query))
    : customers;

  if (filtered.length === 0) {
    log.warning(`No customers matching "${query}"`);
    return null;
  }

  const options = filtered.slice(0, 20).map((c) => ({
    value: c.id,
    label: c.displayName,
  }));
  options.push({ value: "__cancel__", label: "← Cancel" });

  const picked = await select({
    message: "Pick customer:",
    options,
  });

  if (isCancel(picked) || picked === "__cancel__") return null;
  return picked as string;
}

// ── Context rendering ─────────────────────────────────

function renderContext(item: ResolutionItem): void {
  const ctx = item.context;
  if (!ctx) return;

  // Transaction context (customer_match)
  if (ctx.amount) {
    const amount = Math.abs(ctx.amount as number);
    const direction = (ctx.amount as number) > 0 ? "incoming" : "outgoing";
    log.message(`  Amount: $${amount.toLocaleString()} (${direction})`);
  }

  if (ctx.postedAt) {
    log.message(`  Date: ${new Date(ctx.postedAt as string).toLocaleDateString()}`);
  }

  // Transaction history for customer_match
  if (ctx.transactionCount && (ctx.transactionCount as number) > 1) {
    log.message(`  Transactions: ${ctx.transactionCount} totaling $${((ctx.totalAmount as number) || 0).toLocaleString()}`);
  }

  // Engineer split context
  if (ctx.totalAmount && item.type === "engineer_split") {
    log.message(`  Total: $${(ctx.totalAmount as number).toLocaleString()}`);
  }

  if (ctx.teamMembers) {
    const members = ctx.teamMembers as { id: string; name: string; rate?: number }[];
    log.message(`  Team: ${members.map((m) => m.name).join(", ")}`);
  }

  if (ctx.transactionIds) {
    log.message(`  Transactions: ${(ctx.transactionIds as string[]).length} payments`);
  }
}

// ── Option builders ───────────────────────────────────

function buildOptions(item: ResolutionItem, hasCustomerList: boolean) {
  const options: { value: Record<string, unknown>; label: string; hint?: string }[] = [];

  if (item.type === "customer_match") {
    if (item.suggestedMatch) {
      options.push({
        value: { action: "approve", customerId: item.suggestedMatch.id },
        label: `✓ Accept: ${item.suggestedMatch.label}`,
      });
    }
    if (hasCustomerList) {
      options.push({
        value: { action: "pick_alternative" },
        label: "🔍 Pick different customer",
      });
    }
    options.push(
      { value: { action: "reject" }, label: "✗ Reject (wrong match)" },
      { value: { action: "skip" }, label: "⏭ Skip" }
    );
  } else if (item.type === "engineer_split") {
    // Pre-calculated split suggestions
    const teamMembers = (item.context?.teamMembers as { id: string; name: string; rate?: number }[]) || [];
    const total = (item.context?.totalAmount as number) || 0;

    if (teamMembers.length > 0 && total > 0) {
      // Equal split
      const equalAmount = Math.round((total / teamMembers.length) * 100) / 100;
      options.push({
        value: {
          action: "manual",
          engineerSplits: teamMembers.map((m) => ({ teamMemberId: m.id, amount: equalAmount })),
        },
        label: `Equal split ($${equalAmount.toLocaleString()} each)`,
      });

      // Weighted by rate (if rates available)
      const withRates = teamMembers.filter((m) => m.rate && m.rate > 0);
      if (withRates.length === teamMembers.length) {
        const totalRate = withRates.reduce((s, m) => s + (m.rate || 0), 0);
        options.push({
          value: {
            action: "manual",
            engineerSplits: withRates.map((m) => ({
              teamMemberId: m.id,
              amount: Math.round(((m.rate! / totalRate) * total) * 100) / 100,
            })),
          },
          label: `Weighted by rate`,
        });
      }
    }

    options.push(
      { value: { action: "skip" }, label: "⏭ Skip" }
    );
  } else {
    if (item.suggestedMatch) {
      options.push({
        value: { action: "approve" },
        label: `✓ Accept: ${item.suggestedMatch.label}`,
      });
    }
    options.push(
      { value: { action: "reject" }, label: "✗ Reject" },
      { value: { action: "skip" }, label: "⏭ Skip" }
    );
  }

  return options;
}

// ── UI helpers ────────────────────────────────────────

function renderConfidenceBar(confidence: number): string {
  const width = 20;
  const filled = Math.round((confidence / 100) * width);
  const empty = width - filled;

  let color: string;
  if (confidence >= 80) color = "🟩";
  else if (confidence >= 50) color = "🟨";
  else color = "🟥";

  // Use simple ASCII bar since clack doesn't support color codes well
  const bar = "█".repeat(filled) + "░".repeat(empty);
  return `[${bar}]`;
}

function showSessionSummary(resolved: number, skipped: number, total: number) {
  log.step("");
  log.success(`Session: ${resolved} resolved, ${skipped} skipped, ${total - resolved - skipped} remaining`);
}
