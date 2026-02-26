import "dotenv/config";
import { getTeams, getProjects, getTeamMembers } from "../src/lib/linear";

async function main() {
  const teams = await getTeams();
  console.log("=== LINEAR TEAMS ===");
  for (const t of teams) {
    console.log(`  ${t.name} (${t.key}) → id: ${t.id}`);
  }

  const sfaiTeam = teams.find((t) => t.name.toLowerCase().includes("sfai"));
  if (!sfaiTeam) {
    console.log("\nNo team with 'sfai' in the name found.");
    console.log("Available teams:", teams.map((t) => t.name).join(", "));
    return;
  }

  console.log(`\nUsing team: ${sfaiTeam.name}\n`);

  const projects = await getProjects(sfaiTeam.id);
  console.log("=== LINEAR PROJECTS ===");
  for (const p of projects) {
    console.log(`  ${p.name} (${p.state}) → id: ${p.id}`);
  }

  const members = await getTeamMembers(sfaiTeam.id);
  console.log("\n=== LINEAR TEAM MEMBERS ===");
  for (const m of members) {
    console.log(`  ${m.name} (${m.email}) → id: ${m.id}`);
  }
}

main().catch(console.error);
