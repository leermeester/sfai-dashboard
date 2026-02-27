import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateBody, confirmWeekPayloadSchema } from "@/lib/validations";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = validateBody(confirmWeekPayloadSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { weekStart: weekStartStr, forecasts } = parsed.data;
  const weekStart = new Date(weekStartStr);

  // Delete existing forecasts for this week
  await db.demandForecast.deleteMany({
    where: { weekStart },
  });

  // Create all forecasts in batch
  for (const forecast of forecasts) {
    await db.demandForecast.create({
      data: {
        customerId: forecast.customerId,
        teamMemberId: forecast.teamMemberId || null,
        weekStart,
        ticketsNeeded: forecast.ticketsNeeded ?? null,
        hoursNeeded: forecast.hoursNeeded ?? forecast.ticketsNeeded ?? 0,
        confidence: forecast.confidence || null,
        notes: forecast.notes || null,
        source: forecast.source || "manual",
      },
    });
  }

  return NextResponse.json({ success: true, count: forecasts.length });
}
