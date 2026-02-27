import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentWeekStart } from "@/lib/capacity";
import { addWeeks } from "date-fns";
import { validateBody, forecastPayloadSchema } from "@/lib/validations";

/**
 * Legacy endpoint — kept for backward compatibility.
 * Converts old forecastType ("this_week"/"next_week") to weekStart dates.
 * New code should use PUT /api/capacity/forecast instead.
 */
export async function PUT(request: Request) {
  const body = await request.json();
  const parsed = validateBody(forecastPayloadSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { forecasts, forecastType } = parsed.data;

  const currentWeek = getCurrentWeekStart();
  const weekStart = forecastType === "next_week" ? addWeeks(currentWeek, 1) : currentWeek;

  // Delete existing forecasts for this week
  await db.demandForecast.deleteMany({
    where: { weekStart },
  });

  // Create new forecasts
  for (const forecast of forecasts) {
    await db.demandForecast.create({
      data: {
        customerId: forecast.customerId,
        teamMemberId: forecast.teamMemberId || null,
        weekStart,
        hoursNeeded: forecast.hoursNeeded,
        confidence: forecast.confidence,
        notes: forecast.notes,
      },
    });
  }

  return NextResponse.json({ success: true });
}
