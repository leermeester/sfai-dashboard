#!/usr/bin/env node

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(import.meta.dirname, "../.env") });

import { intro, outro, log } from "@clack/prompts";
import { status } from "./commands/status.js";
import { match } from "./commands/match.js";
import { sync } from "./commands/sync.js";
import { backfill } from "./commands/backfill.js";
import { health } from "./commands/health.js";
import { proposals } from "./commands/proposals.js";
import { rules } from "./commands/rules.js";
import { capacity } from "./commands/capacity.js";

const BASE_URL = process.env.SFAI_DASHBOARD_URL || "http://localhost:3000";
const AUTH_TOKEN = process.env.CRON_SECRET || "";

const command = process.argv[2];
const flags = process.argv.slice(3);

intro("SFAI Data Triage");

async function main() {
  if (!AUTH_TOKEN) {
    log.warning("CRON_SECRET not set — API calls will fail. Set it in your environment.");
  }

  switch (command) {
    case "status":
      await status(BASE_URL, AUTH_TOKEN);
      break;
    case "match":
      await match(BASE_URL, flags, AUTH_TOKEN);
      break;
    case "sync":
      await sync(BASE_URL, AUTH_TOKEN);
      break;
    case "backfill":
      await backfill(BASE_URL, AUTH_TOKEN);
      break;
    case "health":
      await health(BASE_URL, AUTH_TOKEN);
      break;
    case "proposals":
      await proposals(BASE_URL, flags, AUTH_TOKEN);
      break;
    case "rules":
      await rules(BASE_URL, flags, AUTH_TOKEN);
      break;
    case "capacity":
      await capacity(BASE_URL, flags, AUTH_TOKEN);
      break;
    default:
      log.info("Commands:");
      log.step("  sfai status     — Show pending item counts");
      log.step("  sfai match      — Interactive resolution session");
      log.step("  sfai health     — Sync health + reconciliation completeness");
      log.step("  sfai sync       — Trigger all syncs");
      log.step("  sfai backfill   — Scan existing data for unmatched entities");
      log.step("  sfai proposals  — Review auto-learned rule proposals");
      log.step("  sfai rules      — Manage active matching rules");
      log.step("  sfai capacity   — Team capacity planning & forecasting");
      log.step("  sfai capacity plan   — Update weekly forecasts");
      log.step("  sfai capacity detail — Full 4-week breakdown");
      log.step("");
      log.step("Match options:");
      log.step("  --type <type>        — Filter by type");
      log.step("  --batch              — Batch approve high-confidence items");
      log.step("  --min-confidence N   — Only show items above N% confidence");
      break;
  }

  outro("Done");
}

main().catch((err) => {
  log.error(String(err));
  process.exit(1);
});
