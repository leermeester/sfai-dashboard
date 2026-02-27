import { select, log, spinner, isCancel, confirm } from "@clack/prompts";
import { authHeaders } from "../auth.js";

interface SystemRule {
  id: string;
  type: string;
  source: string;
  payload: Record<string, unknown>;
  isActive: boolean;
  hitCount: number;
  lastHitAt: string | null;
  createdAt: string;
}

const typeEmoji: Record<string, string> = {
  alias: "🏷️",
  vendor_pattern: "💳",
  domain_mapping: "📅",
  suppression: "🚫",
};

export async function rules(baseUrl: string, flags: string[], token: string) {
  const showStats = flags.includes("--stats");
  const reviewMode = flags.includes("--review");

  const s = spinner();
  s.start("Fetching rules...");

  const res = await fetch(`${baseUrl}/api/rules`, {
    headers: authHeaders(token),
  });

  if (!res.ok) {
    s.stop(`Failed: ${res.status}`);
    return;
  }

  const data = await res.json();
  const items: SystemRule[] = data.rules || [];
  s.stop(`${items.length} active rules`);

  if (items.length === 0) {
    log.info("No active rules yet. Rules are created when proposals are approved.");
    return;
  }

  if (showStats) {
    renderStats(items);
    return;
  }

  if (reviewMode) {
    await reviewRules(baseUrl, token, items);
    return;
  }

  // Default: list all rules grouped by type
  const byType: Record<string, SystemRule[]> = {};
  for (const rule of items) {
    if (!byType[rule.type]) byType[rule.type] = [];
    byType[rule.type].push(rule);
  }

  for (const [type, typeRules] of Object.entries(byType)) {
    const emoji = typeEmoji[type] || "❓";
    log.step("");
    log.message(`${emoji} ${type} (${typeRules.length})`);

    for (const rule of typeRules) {
      const payload = rule.payload;
      const desc = formatRulePayload(rule.type, payload);
      const hits = rule.hitCount > 0 ? ` [${rule.hitCount} hits]` : " [never used]";
      const source = rule.source === "proposal-approved" ? "auto" : rule.source;
      log.step(`  ${desc}${hits} (${source})`);
    }
  }

  log.step("");
  log.info("Use --stats for usage statistics, --review to audit rules");
}

function renderStats(items: SystemRule[]) {
  log.step("");
  log.message("📊 Rule Statistics");

  // Sort by hit count descending
  const sorted = [...items].sort((a, b) => b.hitCount - a.hitCount);

  const mostUsed = sorted.filter((r) => r.hitCount > 0).slice(0, 10);
  const neverUsed = sorted.filter((r) => r.hitCount === 0);

  if (mostUsed.length > 0) {
    log.step("");
    log.message("Most used:");
    for (const rule of mostUsed) {
      const desc = formatRulePayload(rule.type, rule.payload);
      log.step(`  ${desc} — ${rule.hitCount} hits`);
    }
  }

  if (neverUsed.length > 0) {
    log.step("");
    log.message(`Never used (${neverUsed.length} rules — candidates for cleanup):`);
    for (const rule of neverUsed.slice(0, 10)) {
      const desc = formatRulePayload(rule.type, rule.payload);
      log.step(`  ${desc}`);
    }
    if (neverUsed.length > 10) {
      log.step(`  ... and ${neverUsed.length - 10} more`);
    }
  }
}

async function reviewRules(baseUrl: string, token: string, items: SystemRule[]) {
  log.info(`Reviewing ${items.length} rules. Deactivate rules that are no longer needed.`);

  for (const rule of items) {
    const emoji = typeEmoji[rule.type] || "❓";
    const desc = formatRulePayload(rule.type, rule.payload);
    const hits = rule.hitCount > 0 ? `${rule.hitCount} hits` : "never used";

    log.step("");
    log.message(`${emoji} ${desc}`);
    log.info(`  ${hits} | source: ${rule.source} | created: ${new Date(rule.createdAt).toLocaleDateString()}`);

    const result = await select({
      message: "Action:",
      options: [
        { value: "keep", label: "✓ Keep active" },
        { value: "deactivate", label: "✗ Deactivate" },
        { value: "skip", label: "⏭ Skip" },
      ],
    });

    if (isCancel(result)) {
      log.warning("Cancelled");
      return;
    }

    if (result === "deactivate") {
      const s = spinner();
      s.start("Deactivating...");

      const res = await fetch(`${baseUrl}/api/rules/${rule.id}`, {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({ isActive: false }),
      });

      if (res.ok) {
        s.stop("Deactivated ✓");
      } else {
        s.stop("Failed to deactivate");
      }
    }
  }

  log.success("Review complete!");
}

function formatRulePayload(type: string, payload: Record<string, unknown>): string {
  switch (type) {
    case "alias":
      return `"${payload.alias}" → ${payload.customerName || payload.customerId}`;
    case "vendor_pattern":
      return `"${payload.pattern}" → ${payload.category}`;
    case "domain_mapping":
      return `${payload.domain} → ${payload.meetingType}${payload.customerName ? ` (${payload.customerName})` : ""}`;
    case "suppression":
      return `Never match "${payload.sourcePattern}" → ${payload.targetLabel || payload.targetId}`;
    default:
      return JSON.stringify(payload);
  }
}
