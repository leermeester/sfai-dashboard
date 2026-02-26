import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { getTeams, getProjects } from "../src/lib/linear";

const db = new PrismaClient();

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// Manual overrides for names that don't match by normalization
const MANUAL_MAP: Record<string, string> = {
  "yachtmasters": "yacht master hub",
  "radtech": "rad tech",
  "my data move": "mydatamove",
  "gpvp (fnrp)": "gpvp",
  "orgvitality": "org vitality",
  "rx-pharmacy": "rx pharmacy",
  "valencia rc": "valencia",
  "alvamed - literature review": "alvamed",
  "alvamed - sop workflow": "alvamed",
};

async function main() {
  const teams = await getTeams();
  const sfaiTeam = teams.find((t) => t.name.toLowerCase().includes("sfai"));
  if (!sfaiTeam) {
    console.log("No SFAI team found in Linear");
    return;
  }

  const projects = await getProjects(sfaiTeam.id);
  const customers = await db.customer.findMany({ where: { isActive: true } });

  console.log("Matching Linear projects → customers...\n");

  let matched = 0;
  let skipped = 0;
  const unmatched: string[] = [];

  for (const project of projects) {
    // Skip internal projects
    if (normalize(project.name) === "sfailabs" || normalize(project.name) === "linkerr") {
      console.log(`  SKIP  ${project.name} (internal)`);
      skipped++;
      continue;
    }

    const normalizedProject = normalize(project.name);
    const manualTarget = MANUAL_MAP[project.name.toLowerCase()];

    const customer = customers.find((c) => {
      const normalizedCustomer = normalize(c.displayName);
      if (normalizedProject === normalizedCustomer) return true;
      if (manualTarget && normalize(manualTarget) === normalizedCustomer) return true;
      // Substring match as fallback
      if (normalizedCustomer.includes(normalizedProject) || normalizedProject.includes(normalizedCustomer)) return true;
      return false;
    });

    if (customer) {
      // Check if this customer already has a different project ID (Alvamed has 2 projects)
      if (customer.linearProjectId && customer.linearProjectId !== project.id) {
        console.log(`  SKIP  ${project.name} → ${customer.displayName} (already mapped to another project)`);
        skipped++;
        continue;
      }

      await db.customer.update({
        where: { id: customer.id },
        data: { linearProjectId: project.id },
      });
      console.log(`  ✓     ${project.name} → ${customer.displayName} (${project.id})`);
      matched++;
    } else {
      console.log(`  ✗     ${project.name} — no matching customer`);
      unmatched.push(project.name);
    }
  }

  console.log(`\nDone: ${matched} matched, ${skipped} skipped, ${unmatched.length} unmatched`);
  if (unmatched.length > 0) {
    console.log("Unmatched projects:", unmatched.join(", "));
  }

  await db.$disconnect();
}

main().catch(console.error);
