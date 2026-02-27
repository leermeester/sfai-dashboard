import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const rule = await db.systemRule.findUnique({ where: { id } });
  if (!rule) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  const updated = await db.systemRule.update({
    where: { id },
    data: {
      isActive: body.isActive ?? rule.isActive,
    },
  });

  return NextResponse.json({
    rule: { ...updated, payload: JSON.parse(updated.payload) },
  });
}
