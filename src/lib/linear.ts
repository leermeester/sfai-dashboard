const LINEAR_API_URL = "https://api.linear.app/graphql";

async function query(graphqlQuery: string, variables?: Record<string, unknown>) {
  const res = await fetch(LINEAR_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: process.env.LINEAR_API_KEY || "",
    },
    body: JSON.stringify({ query: graphqlQuery, variables }),
  });

  if (!res.ok) throw new Error(`Linear API error: ${res.status}`);
  const data = await res.json();
  if (data.errors) throw new Error(data.errors[0].message);
  return data.data;
}

export interface LinearTeam {
  id: string;
  name: string;
  key: string;
}

export interface LinearProject {
  id: string;
  name: string;
  state: string;
}

export interface LinearIssue {
  id: string;
  title: string;
  state: { name: string; type: string };
  assignee: { id: string; name: string } | null;
  estimate: number | null;
  project: { id: string; name: string } | null;
  createdAt: string;
  completedAt: string | null;
}

export interface LinearUser {
  id: string;
  name: string;
  email: string;
}

export async function getTeams(): Promise<LinearTeam[]> {
  const data = await query(`
    query {
      teams {
        nodes {
          id
          name
          key
        }
      }
    }
  `);
  return data.teams.nodes;
}

export async function getProjects(teamId: string): Promise<LinearProject[]> {
  const data = await query(
    `
    query($teamId: String!) {
      team(id: $teamId) {
        projects {
          nodes {
            id
            name
            state
          }
        }
      }
    }
  `,
    { teamId }
  );
  return data.team.projects.nodes;
}

export async function getActiveIssues(teamId: string): Promise<LinearIssue[]> {
  const data = await query(
    `
    query($teamId: String!) {
      team(id: $teamId) {
        issues(
          filter: { state: { type: { in: ["started", "unstarted"] } } }
          first: 200
        ) {
          nodes {
            id
            title
            state { name type }
            assignee { id name }
            estimate
            project { id name }
            createdAt
            completedAt
          }
        }
      }
    }
  `,
    { teamId }
  );
  return data.team.issues.nodes;
}

export async function getTeamMembers(teamId: string): Promise<LinearUser[]> {
  const data = await query(
    `
    query($teamId: String!) {
      team(id: $teamId) {
        members {
          nodes {
            id
            name
            email
          }
        }
      }
    }
  `,
    { teamId }
  );
  return data.team.members.nodes;
}

export async function testConnection(): Promise<boolean> {
  try {
    const teams = await getTeams();
    return teams.length > 0;
  } catch {
    return false;
  }
}

export async function getWorkload(teamId: string) {
  const issues = await getActiveIssues(teamId);

  // Group by assignee
  const workload = new Map<
    string,
    { name: string; issues: number; points: number; projects: Set<string> }
  >();

  for (const issue of issues) {
    const assigneeId = issue.assignee?.id ?? "unassigned";
    const assigneeName = issue.assignee?.name ?? "Unassigned";

    if (!workload.has(assigneeId)) {
      workload.set(assigneeId, {
        name: assigneeName,
        issues: 0,
        points: 0,
        projects: new Set(),
      });
    }

    const entry = workload.get(assigneeId)!;
    entry.issues++;
    entry.points += issue.estimate ?? 0;
    if (issue.project) entry.projects.add(issue.project.name);
  }

  return Array.from(workload.entries()).map(([id, data]) => ({
    id,
    name: data.name,
    issues: data.issues,
    points: data.points,
    projects: Array.from(data.projects),
  }));
}
