import { log, spinner } from "@clack/prompts";
import { authHeaders } from "../auth.js";

export async function sync(baseUrl: string, token: string) {
  const s = spinner();
  s.start("Running sync...");

  const res = await fetch(`${baseUrl}/api/cron/sync`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const body = await res.text();
    s.stop(`Sync failed: ${res.status}`);
    log.error(body);
    return;
  }

  const data = await res.json();
  s.stop("Sync complete");

  log.info(`Transactions synced: ${data.synced ?? "N/A"}`);
  log.info(`Reconciled: ${data.reconciled ?? "N/A"}`);

  if (data.resolution) {
    log.info(`Resolution items created: ${data.resolution.created ?? 0}`);
    log.info(`Auto-resolved: ${data.resolution.autoResolved ?? 0}`);
  }

  // Proactive nudge: check pending queue after sync
  try {
    const statsRes = await fetch(`${baseUrl}/api/resolution/stats`, {
      headers: authHeaders(token),
    });
    if (statsRes.ok) {
      const stats = await statsRes.json();
      if (stats.pending > 0) {
        log.step("");
        log.warning(`${stats.pending} items need review`);

        // Check how many are high-confidence
        const healthRes = await fetch(`${baseUrl}/api/resolution/health`, {
          headers: authHeaders(token),
        });
        if (healthRes.ok) {
          const health = await healthRes.json();
          const { high } = health.confidenceDistribution || {};
          if (high > 0) {
            log.info(`  💡 ${high} high-confidence items → sfai match --batch`);
          } else {
            log.info(`  💡 Run sfai match to resolve`);
          }
        } else {
          log.info(`  💡 Run sfai match to resolve`);
        }
      }
    }
  } catch {
    // Non-fatal: nudge is optional
  }
}
