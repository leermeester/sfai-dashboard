import { log, spinner } from "@clack/prompts";
import { authHeaders } from "../auth.js";

interface HealthData {
  queue: {
    pending: number;
    autoResolved: number;
    confirmed: number;
    rejected: number;
    byType: Record<string, number>;
  };
  reconciliation: {
    currentMonth: MonthRecon;
    previousMonth: MonthRecon;
  };
  unreconciled: {
    incoming: { count: number; amount: number };
    outgoing: { count: number; amount: number };
  };
  recentAutoResolved: number;
  confidenceDistribution: { high: number; medium: number; low: number };
}

interface MonthRecon {
  month: string;
  reconciledCount: number;
  totalCount: number;
  reconciledRevenue: number;
  expectedRevenue: number;
  completeness: number;
}

export async function health(baseUrl: string, token: string) {
  const s = spinner();
  s.start("Fetching health data...");

  const res = await fetch(`${baseUrl}/api/resolution/health`, {
    headers: authHeaders(token),
  });

  if (!res.ok) {
    s.stop(`Failed: ${res.status}`);
    return;
  }

  const data: HealthData = await res.json();
  s.stop("Health data loaded");

  // ── Resolution Queue ──
  log.step("");
  log.message("📋 Resolution Queue");
  log.message(`  Pending: ${data.queue.pending}${data.queue.pending > 0 ? " ⚠" : " ✓"}`);
  log.message(`  Auto-resolved (7d): ${data.recentAutoResolved}`);
  log.message(`  Confirmed: ${data.queue.confirmed}`);
  log.message(`  Rejected: ${data.queue.rejected}`);

  if (data.queue.pending > 0 && Object.keys(data.queue.byType).length > 0) {
    log.step("  By type:");
    for (const [type, count] of Object.entries(data.queue.byType)) {
      log.step(`    ${type}: ${count}`);
    }
  }

  // ── Confidence distribution ──
  if (data.queue.pending > 0) {
    const { high, medium, low } = data.confidenceDistribution;
    log.step("");
    log.message("📊 Pending Confidence");
    log.message(`  High (≥80%): ${high}${high > 0 ? " — batch-approvable" : ""}`);
    log.message(`  Medium (50-79%): ${medium}`);
    log.message(`  Low (<50%): ${low}${low > 0 ? " — needs careful review" : ""}`);
  }

  // ── Reconciliation Completeness ──
  log.step("");
  log.message("💰 Revenue Reconciliation");
  renderMonthRecon(data.reconciliation.currentMonth);
  renderMonthRecon(data.reconciliation.previousMonth);

  // ── Unreconciled amounts ──
  if (data.unreconciled.incoming.count > 0 || data.unreconciled.outgoing.count > 0) {
    log.step("");
    log.message("⚠ Unreconciled");
    if (data.unreconciled.incoming.count > 0) {
      log.message(
        `  Incoming: ${data.unreconciled.incoming.count} txns ($${data.unreconciled.incoming.amount.toLocaleString()})`
      );
    }
    if (data.unreconciled.outgoing.count > 0) {
      log.message(
        `  Outgoing: ${data.unreconciled.outgoing.count} txns ($${data.unreconciled.outgoing.amount.toLocaleString()}) uncategorized`
      );
    }
  }

  // ── Actionable nudge ──
  log.step("");
  if (data.queue.pending > 0) {
    const { high } = data.confidenceDistribution;
    if (high > 0) {
      log.info(`💡 ${high} high-confidence items ready for batch approval → sfai match --batch`);
    } else {
      log.info(`💡 ${data.queue.pending} items need review → sfai match`);
    }
  } else {
    log.success("All caught up — no pending items.");
  }
}

function renderMonthRecon(month: MonthRecon) {
  const bar = renderBar(month.completeness);
  const rev = month.reconciledRevenue > 0
    ? `$${month.reconciledRevenue.toLocaleString()}`
    : "$0";
  const exp = month.expectedRevenue > 0
    ? ` / $${month.expectedRevenue.toLocaleString()} expected`
    : "";

  log.message(`  ${month.month}: ${bar} ${month.completeness}% (${rev}${exp})`);
}

function renderBar(pct: number): string {
  const width = 15;
  const filled = Math.round((pct / 100) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}
