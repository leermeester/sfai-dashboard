/**
 * Data migration: Simplify resolution system
 *
 * 1. Update BankTransaction.costCategory values:
 *    - "labor" → "engineer"
 *    - "other" → "overhead"
 *    - NULL (outgoing) → "overhead"
 *
 * 2. Mark obsolete resolution items as rejected:
 *    - domain_classify, vendor_categorize, sheet_customer → status = "rejected", resolvedVia = "migration"
 *
 * Run: npx tsx prisma/migrate-resolution-simplify.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("Starting resolution simplification migration...\n");

  // 1. Update cost categories
  const laborToEngineer = await db.bankTransaction.updateMany({
    where: { costCategory: "labor" },
    data: { costCategory: "engineer" },
  });
  console.log(`  costCategory "labor" → "engineer": ${laborToEngineer.count} rows`);

  const otherToOverhead = await db.bankTransaction.updateMany({
    where: { costCategory: "other" },
    data: { costCategory: "overhead" },
  });
  console.log(`  costCategory "other" → "overhead": ${otherToOverhead.count} rows`);

  const nullToOverhead = await db.bankTransaction.updateMany({
    where: { direction: "outgoing", costCategory: null },
    data: { costCategory: "overhead" },
  });
  console.log(`  costCategory NULL (outgoing) → "overhead": ${nullToOverhead.count} rows`);

  // 2. Mark obsolete resolution items
  const obsoleteTypes = ["domain_classify", "vendor_categorize", "sheet_customer"];

  const obsolete = await db.resolutionItem.updateMany({
    where: {
      type: { in: obsoleteTypes },
      status: "pending",
    },
    data: {
      status: "rejected",
      resolvedAt: new Date(),
      resolvedVia: "migration",
    },
  });
  console.log(`\n  Pending obsolete resolution items marked rejected: ${obsolete.count}`);

  // Also mark auto_resolved ones from obsolete types (informational)
  const obsoleteAutoResolved = await db.resolutionItem.count({
    where: {
      type: { in: obsoleteTypes },
      status: "auto_resolved",
    },
  });
  console.log(`  Already auto-resolved obsolete items (left as-is): ${obsoleteAutoResolved}`);

  // Summary
  const remaining = await db.resolutionItem.count({
    where: { status: "pending" },
  });
  console.log(`\n  Remaining pending resolution items: ${remaining}`);

  console.log("\nMigration complete.");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
