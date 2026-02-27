import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { validateBody, teamMemberSchema } from "@/lib/validations";

export async function GET() {
  const members = await db.teamMember.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ members });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const parsed = validateBody(z.object({ members: z.array(teamMemberSchema) }), body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { members } = parsed.data;

  const existing = await db.teamMember.findMany({ where: { isActive: true }, select: { id: true } });
  const existingIds = new Set(existing.map((m) => m.id));
  const incomingIds = new Set(
    members
      .filter((m: { id: string }) => !m.id.startsWith("new-"))
      .map((m: { id: string }) => m.id)
  );

  // Soft-delete removed team members
  for (const id of existingIds) {
    if (!incomingIds.has(id)) {
      await db.teamMember.update({ where: { id }, data: { isActive: false } });
    }
  }

  const result = [];
  for (const member of members) {
    const data = {
      name: member.name,
      email: member.email || null,
      role: member.role,
      hourlyRate: member.hourlyRate ?? null,
      monthlyCost: member.monthlyCost ?? null,
      isActive: member.isActive ?? true,
      linearUserId: member.linearUserId || null,
      mercuryCounterparty: member.mercuryCounterparty || null,
    };

    if (member.id.startsWith("new-")) {
      const created = await db.teamMember.create({ data });
      result.push(created);
    } else {
      const updated = await db.teamMember.update({
        where: { id: member.id },
        data,
      });
      result.push(updated);
    }
  }

  return NextResponse.json({ members: result });
}
