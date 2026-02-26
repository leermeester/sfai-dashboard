import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(request: Request) {
  const { members } = await request.json();

  const existing = await db.teamMember.findMany({ select: { id: true } });
  const existingIds = new Set(existing.map((m) => m.id));
  const incomingIds = new Set(
    members
      .filter((m: { id: string }) => !m.id.startsWith("new-"))
      .map((m: { id: string }) => m.id)
  );

  for (const id of existingIds) {
    if (!incomingIds.has(id)) {
      await db.teamMember.delete({ where: { id } });
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
