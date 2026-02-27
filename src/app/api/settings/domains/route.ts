import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { validateBody, domainMappingSchema } from "@/lib/validations";

export async function GET() {
  const mappings = await db.domainMapping.findMany({
    orderBy: { domain: "asc" },
  });
  return NextResponse.json({ mappings });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const parsed = validateBody(z.object({ mappings: z.array(domainMappingSchema) }), body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  for (const m of parsed.data.mappings) {
    await db.domainMapping.upsert({
      where: { domain: m.domain },
      create: {
        domain: m.domain,
        meetingType: m.meetingType,
        customerId: m.meetingType === "client" ? m.customerId : null,
      },
      update: {
        meetingType: m.meetingType,
        customerId: m.meetingType === "client" ? m.customerId : null,
      },
    });
  }

  return NextResponse.json({ success: true });
}
