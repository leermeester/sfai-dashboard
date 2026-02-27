import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeEngineerThroughput } from "@/lib/capacity";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** GET — returns per-engineer throughput rates. */
export async function GET() {
  try {
    const throughput = await computeEngineerThroughput();
    const data = Object.fromEntries(throughput);
    return NextResponse.json({ throughput: data });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

const upsertSchema = z.object({
  teamMemberId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  billedHours: z.number().min(0),
});

/** PUT — upsert billed hours for a given month + engineer. */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const parsed = upsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { teamMemberId, month, billedHours } = parsed.data;

    const record = await db.engineerThroughput.upsert({
      where: { teamMemberId_month: { teamMemberId, month } },
      create: { teamMemberId, month, billedHours },
      update: { billedHours, completedTickets: null }, // reset computed tickets on hours change
    });

    return NextResponse.json({ success: true, record });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
