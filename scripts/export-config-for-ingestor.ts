import "dotenv/config";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

// Export Customer + TeamMember + DomainMapping rows as a JSON bundle
// for sfai-data-ingestor's `import-dashboard-config` script to consume.
//
//   pnpm tsx scripts/export-config-for-ingestor.ts
//
// Writes ./dashboard-config.json. Copy the file into the ingestor repo
// (e.g. tmp/dashboard-config.json) and run the import there.

const db = new PrismaClient();

async function main(): Promise<void> {
  const customers = await db.customer.findMany({
    where: { isActive: true },
    select: {
      displayName: true,
      aliases: true,
      emailDomain: true,
      bankName: true,
      linearProjectId: true,
    },
    orderBy: { displayName: "asc" },
  });

  const teamMembers = await db.teamMember.findMany({
    where: { isActive: true, linearUserId: { not: null } },
    select: {
      name: true,
      email: true,
      linearUserId: true,
      mercuryCounterparty: true,
    },
    orderBy: { name: "asc" },
  });

  const domainMappingsRaw = await db.domainMapping.findMany({
    where: { customerId: { not: null } },
    select: {
      domain: true,
      customer: { select: { displayName: true } },
    },
  });
  const domainMappings = domainMappingsRaw
    .filter((d) => d.customer != null)
    .map((d) => ({ domain: d.domain, customerDisplayName: d.customer!.displayName }));

  const bundle = {
    exportedAt: new Date().toISOString(),
    customers,
    teamMembers,
    domainMappings,
  };

  const outPath = resolve(process.cwd(), "dashboard-config.json");
  writeFileSync(outPath, JSON.stringify(bundle, null, 2) + "\n");

  console.log(`[export] wrote ${outPath}`);
  console.log(`  customers:       ${customers.length}`);
  console.log(`  team members:    ${teamMembers.length}`);
  console.log(`  domain mappings: ${domainMappings.length}`);
}

main()
  .catch((e) => {
    console.error("export-config-for-ingestor failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
