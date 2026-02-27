import { log } from "@clack/prompts";
import { authHeaders } from "../auth.js";

export async function status(baseUrl: string, token: string) {
  const res = await fetch(`${baseUrl}/api/resolution/stats`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();

  log.info(`Pending: ${data.pending}`);
  log.info(`Auto-resolved: ${data.autoResolved}`);
  log.info(`Confirmed: ${data.confirmed}`);
  log.info(`Rejected: ${data.rejected}`);

  if (data.byType && Object.keys(data.byType).length > 0) {
    log.step("");
    log.step("By type:");
    for (const [type, count] of Object.entries(data.byType)) {
      log.step(`  ${type}: ${count}`);
    }
  }
}
