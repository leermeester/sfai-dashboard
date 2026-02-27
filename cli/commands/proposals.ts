import { select, log, spinner, isCancel } from "@clack/prompts";
import { authHeaders } from "../auth.js";

interface Proposal {
  id: string;
  type: string;
  status: string;
  description: string;
  evidence: Record<string, unknown> | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

const typeEmoji: Record<string, string> = {
  alias: "🏷️",
  vendor_pattern: "💳",
  domain_mapping: "📅",
  suppression: "🚫",
  threshold: "📊",
};

export async function proposals(baseUrl: string, flags: string[], token: string) {
  const s = spinner();
  s.start("Fetching proposals...");

  const res = await fetch(`${baseUrl}/api/proposals?status=pending`, {
    headers: authHeaders(token),
  });

  if (!res.ok) {
    s.stop(`Failed: ${res.status}`);
    return;
  }

  const data = await res.json();
  const items: Proposal[] = data.proposals || [];
  s.stop(`${items.length} pending proposals`);

  if (items.length === 0) {
    log.success("No pending proposals — system is up to date.");
    return;
  }

  for (const proposal of items) {
    const emoji = typeEmoji[proposal.type] || "❓";

    log.step("");
    log.message(`${emoji} ${proposal.type.toUpperCase()}`);
    log.message(`  ${proposal.description}`);

    if (proposal.evidence) {
      const evidence = proposal.evidence;
      if (evidence.resolutionCount) {
        log.info(`  Based on ${evidence.resolutionCount} resolution(s)`);
      }
      if (evidence.sourceEntity) {
        log.info(`  From: "${evidence.sourceEntity}"`);
      }
    }

    log.info(`  Created: ${new Date(proposal.createdAt).toLocaleDateString()}`);

    const result = await select({
      message: "Action:",
      options: [
        { value: "approve", label: "✓ Approve — activate this rule" },
        { value: "reject", label: "✗ Reject — discard this proposal" },
        { value: "skip", label: "⏭ Skip — decide later" },
      ],
    });

    if (isCancel(result)) {
      log.warning("Cancelled");
      return;
    }

    if (result === "skip") {
      log.info("  ⏭ Skipped");
      continue;
    }

    const resolveS = spinner();
    resolveS.start("Processing...");

    const resolveRes = await fetch(`${baseUrl}/api/proposals/${proposal.id}/resolve`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ action: result }),
    });

    if (resolveRes.ok) {
      const msg = result === "approve" ? "Approved ✓ — rule is now active" : "Rejected ✗";
      resolveS.stop(msg);
    } else {
      const err = await resolveRes.json();
      resolveS.stop(`Error: ${err.error}`);
    }
  }

  log.success("All proposals reviewed!");
}
