import { NextResponse } from "next/server";
import * as linear from "@/lib/linear";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  if (searchParams.get("test") === "true") {
    const connected = await linear.testConnection();
    return NextResponse.json({ connected });
  }

  // Return workload data
  try {
    const teams = await linear.getTeams();
    const sfaiTeam = teams.find(
      (t) => t.name.toLowerCase().includes("sfai")
    );
    if (!sfaiTeam) {
      return NextResponse.json({ error: "SFAI Labs team not found" }, { status: 404 });
    }

    const workload = await linear.getWorkload(sfaiTeam.id);
    const projects = await linear.getProjects(sfaiTeam.id);

    return NextResponse.json({ workload, projects });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
