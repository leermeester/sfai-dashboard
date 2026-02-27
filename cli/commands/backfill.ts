import { log, spinner } from "@clack/prompts";
import { authHeaders } from "../auth.js";

export async function backfill(baseUrl: string, token: string) {
  const s = spinner();
  s.start("Scanning existing data for unmatched entities...");

  const res = await fetch(`${baseUrl}/api/resolution/backfill`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!res.ok) {
    s.stop(`Backfill failed: ${res.status}`);
    return;
  }

  const data = await res.json();
  s.stop("Backfill complete");

  log.info(`Scanned:`);
  log.step(`  Unmatched incoming transactions: ${data.scanned?.unmatchedIncoming ?? 0}`);
  log.step(`  Unmatched outgoing transactions: ${data.scanned?.unmatchedOutgoing ?? 0}`);
  log.step(`  Unmatched domains: ${data.scanned?.unmatchedDomains ?? 0}`);
  log.info(`Resolution items:`);
  log.step(`  Created (pending): ${data.resolution?.created ?? 0}`);
  log.step(`  Auto-resolved: ${data.resolution?.autoResolved ?? 0}`);
  log.step(`  Skipped (duplicates): ${data.resolution?.skipped ?? 0}`);
}
