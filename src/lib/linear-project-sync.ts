import { db } from "./db";
import { getTeams, getProjects } from "./linear";

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// Manual overrides for Linear project names that don't match customer displayNames
const MANUAL_MAP: Record<string, string> = {
  yachtmasters: "yacht master hub",
  radtech: "rad tech",
  "my data move": "mydatamove",
  "gpvp (fnrp)": "gpvp",
  orgvitality: "org vitality",
  "rx-pharmacy": "rx pharmacy",
  "valencia rc": "valencia",
  "alvamed - literature review": "alvamed",
  "alvamed - sop workflow": "alvamed",
  linkerr: "meigma",
};

// Linear projects that are internal and should not map to customers
const INTERNAL_PROJECTS = new Set(["sfailabs"]);

export async function syncLinearProjectIds(): Promise<{
  matched: number;
  skipped: number;
  unmatched: string[];
}> {
  const teams = await getTeams();
  const sfaiTeam = teams.find((t) =>
    t.name.toLowerCase().includes("sfai")
  );
  if (!sfaiTeam) throw new Error("SFAI team not found in Linear");

  const projects = await getProjects(sfaiTeam.id);
  const customers = await db.customer.findMany({ where: { isActive: true } });

  let matched = 0;
  let skipped = 0;
  const unmatched: string[] = [];

  for (const project of projects) {
    const normalizedProject = normalize(project.name);

    if (INTERNAL_PROJECTS.has(normalizedProject)) {
      skipped++;
      continue;
    }

    const manualTarget = MANUAL_MAP[project.name.toLowerCase()];

    const customer = customers.find((c) => {
      const normalizedCustomer = normalize(c.displayName);
      if (normalizedProject === normalizedCustomer) return true;
      if (manualTarget && normalize(manualTarget) === normalizedCustomer)
        return true;
      if (
        normalizedCustomer.includes(normalizedProject) ||
        normalizedProject.includes(normalizedCustomer)
      )
        return true;
      return false;
    });

    if (customer) {
      if (customer.linearProjectId && customer.linearProjectId !== project.id) {
        skipped++;
        continue;
      }

      await db.customer.update({
        where: { id: customer.id },
        data: { linearProjectId: project.id },
      });
      matched++;
    } else {
      unmatched.push(project.name);
    }
  }

  return { matched, skipped, unmatched };
}
