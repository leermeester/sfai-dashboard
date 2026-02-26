import { PrismaClient } from "@prisma/client";
import { getSheetData, createSnapshot } from "../src/lib/sheets";
import { getTeams, getTeamMembers } from "../src/lib/linear";
import { syncTransactions } from "../src/lib/mercury";
import * as fs from "fs";
import * as path from "path";

const db = new PrismaClient();

interface SeedConfig {
  customerOverrides?: Record<
    string,
    {
      bankName?: string;
      aliases?: string[];
      linearProjectId?: string;
      email?: string;
    }
  >;
  teamOverrides?: Record<
    string,
    {
      role?: string;
      hourlyRate?: number;
      monthlyCost?: number;
    }
  >;
  skipCustomerNames?: string[];
}

const BUILTIN_SKIP_NAMES = [
  "total",
  "grand total",
  "subtotal",
  "sum",
  "totals",
];

function loadConfig(): SeedConfig {
  const configPath = path.join(__dirname, "seed-config.json");
  if (fs.existsSync(configPath)) {
    console.log("Loaded seed-config.json");
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
  }
  console.log("No seed-config.json found (optional — proceeding without overrides)");
  return {};
}

async function seedCustomersFromSheets(config: SeedConfig) {
  console.log("\n--- Discovering customers from Google Sheets ---");

  const cells = await getSheetData();
  console.log(`Fetched ${cells.length} revenue cells from sheet`);

  const skipNames = new Set([
    ...BUILTIN_SKIP_NAMES,
    ...(config.skipCustomerNames ?? []).map((n) => n.toLowerCase()),
  ]);

  // Only include names with at least one positive revenue cell
  const customerRevenue = new Map<string, number>();
  for (const cell of cells) {
    customerRevenue.set(
      cell.customer,
      (customerRevenue.get(cell.customer) ?? 0) + cell.amount
    );
  }

  const validCustomers = [...customerRevenue.entries()]
    .filter(
      ([name, total]) =>
        total > 0 && !skipNames.has(name.toLowerCase().trim())
    )
    .map(([name]) => name);

  console.log(
    `Found ${validCustomers.length} customers with revenue data (filtered ${customerRevenue.size - validCustomers.length} noise rows)`
  );

  let created = 0;
  let skipped = 0;

  for (const name of validCustomers) {
    const overrides = config.customerOverrides?.[name] ?? {};

    // Check if customer already exists
    const existing = await db.customer.findFirst({
      where: {
        OR: [
          { spreadsheetName: name },
          { displayName: name },
        ],
      },
    });

    if (existing) {
      console.log(`  SKIP: "${name}" (already exists as "${existing.displayName}")`);
      skipped++;
      continue;
    }

    await db.customer.create({
      data: {
        displayName: name,
        spreadsheetName: name,
        bankName: overrides.bankName ?? null,
        aliases: overrides.aliases ?? [],
        linearProjectId: overrides.linearProjectId ?? null,
        email: overrides.email ?? null,
      },
    });
    console.log(`  CREATED: "${name}"`);
    created++;
  }

  console.log(`\nCustomers: ${created} created, ${skipped} already existed`);
}

async function seedTeamFromLinear(config: SeedConfig) {
  console.log("\n--- Discovering team from Linear ---");

  const teams = await getTeams();
  const sfaiTeam = teams.find((t) =>
    t.name.toLowerCase().includes("sfai")
  );

  if (!sfaiTeam) {
    console.log(
      "WARNING: No team containing 'sfai' found in Linear. Available teams:"
    );
    teams.forEach((t) => console.log(`  - ${t.name} (${t.key})`));
    console.log("Skipping team seed.");
    return;
  }

  console.log(`Found team: "${sfaiTeam.name}" (${sfaiTeam.key})`);

  const members = await getTeamMembers(sfaiTeam.id);
  console.log(`Found ${members.length} members`);

  let created = 0;
  let updated = 0;

  for (const member of members) {
    const overrides = config.teamOverrides?.[member.email] ?? {};

    if (!member.email) {
      console.log(`  SKIP: "${member.name}" (no email in Linear)`);
      continue;
    }

    const existing = await db.teamMember.findUnique({
      where: { email: member.email },
    });

    if (existing) {
      await db.teamMember.update({
        where: { email: member.email },
        data: {
          linearUserId: member.id,
          ...(overrides.role ? { role: overrides.role } : {}),
          ...(overrides.hourlyRate != null ? { hourlyRate: overrides.hourlyRate } : {}),
          ...(overrides.monthlyCost != null ? { monthlyCost: overrides.monthlyCost } : {}),
        },
      });
      console.log(`  UPDATED: ${member.name} (${member.email})`);
      updated++;
    } else {
      await db.teamMember.create({
        data: {
          name: member.name,
          email: member.email,
          role: overrides.role ?? "engineer",
          hourlyRate: overrides.hourlyRate ?? null,
          monthlyCost: overrides.monthlyCost ?? null,
          linearUserId: member.id,
        },
      });
      console.log(`  CREATED: ${member.name} (${member.email})`);
      created++;
    }
  }

  console.log(`\nTeam: ${created} created, ${updated} updated`);
}

async function runInitialSync() {
  console.log("\n--- Running initial Google Sheets snapshot ---");
  const snapshotResult = await createSnapshot(db);
  console.log(`Snapshot: ${snapshotResult.created} revenue cells created`);
  if (snapshotResult.unmatched.length > 0) {
    console.log("WARNING: Unmatched sheet names (not linked to any customer):");
    snapshotResult.unmatched.forEach((n) => console.log(`  - "${n}"`));
  }

  console.log("\n--- Running initial Mercury transaction sync ---");
  const mercuryResult = await syncTransactions(db);
  console.log(
    `Mercury: ${mercuryResult.synced} transactions synced, ${mercuryResult.reconciled} auto-reconciled`
  );
}

async function printSummary() {
  console.log("\n========== SEED SUMMARY ==========");
  const customers = await db.customer.count();
  const team = await db.teamMember.count();
  const snapshots = await db.salesSnapshot.count();
  const txns = await db.bankTransaction.count();
  const reconciled = await db.bankTransaction.count({
    where: { isReconciled: true },
  });
  const unreconciled = txns - reconciled;

  console.log(`Customers:          ${customers}`);
  console.log(`Team Members:       ${team}`);
  console.log(`Sales Snapshots:    ${snapshots}`);
  console.log(`Bank Transactions:  ${txns} (${reconciled} reconciled, ${unreconciled} unreconciled)`);
  console.log("==================================\n");

  // Flag what still needs manual work
  const noBank = await db.customer.findMany({ where: { bankName: null } });
  const noCost = await db.teamMember.findMany({ where: { monthlyCost: null } });

  if (noBank.length > 0) {
    console.log(`ACTION REQUIRED: ${noBank.length} customers have no bankName set:`);
    noBank.forEach((c) => console.log(`  - ${c.displayName}`));
    console.log("  → Set via Settings > Customers so Mercury transactions can be reconciled\n");
  }

  if (noCost.length > 0) {
    console.log(`ACTION REQUIRED: ${noCost.length} team members have no monthlyCost set:`);
    noCost.forEach((m) => console.log(`  - ${m.name}`));
    console.log("  → Set via Settings > Team for margin calculations\n");
  }

  // Show Stripe payouts that need attention
  const stripeTxns = await db.bankTransaction.findMany({
    where: { description: { startsWith: "[Stripe Payout]" } },
  });
  if (stripeTxns.length > 0) {
    const stripeTotal = stripeTxns.reduce((sum, t) => sum + t.amount, 0);
    console.log(
      `INFO: ${stripeTxns.length} Stripe payouts detected ($${stripeTotal.toLocaleString()})`
    );
    console.log("  → These need manual reconciliation in Sales > Unreconciled\n");
  }
}

async function main() {
  console.log("SFAI Dashboard — Seed Script\n");

  const config = loadConfig();

  await seedCustomersFromSheets(config);
  await seedTeamFromLinear(config);
  await runInitialSync();
  await printSummary();

  console.log("Done! Open the dashboard to verify data.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
