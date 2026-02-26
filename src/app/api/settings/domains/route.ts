import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const mappings = await db.domainMapping.findMany({
    orderBy: { domain: "asc" },
  });
  return NextResponse.json({ mappings });
}

export async function PUT(request: Request) {
  const { mappings } = await request.json();

  for (const m of mappings as Array<{
    domain: string;
    meetingType: string;
    customerId: string | null;
  }>) {
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
