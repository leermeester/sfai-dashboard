import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateBody, capacityForecastPayloadSchema } from "@/lib/validations";

export async function PUT(request: Request) {
  const body = await request.json();
  const parsed = validateBody(capacityForecastPayloadSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { forecasts } = parsed.data;
  const results = [];

  for (const forecast of forecasts) {
    const weekStart = new Date(forecast.weekStart);
    const ticketsNeeded = forecast.ticketsNeeded ?? null;
    const hoursNeeded = forecast.hoursNeeded ?? forecast.ticketsNeeded ?? 0;

    const result = await db.demandForecast.upsert({
      where: {
        customerId_teamMemberId_weekStart: {
          customerId: forecast.customerId,
          teamMemberId: forecast.teamMemberId || "",
          weekStart,
        },
      },
      create: {
        customerId: forecast.customerId,
        teamMemberId: forecast.teamMemberId || null,
        weekStart,
        ticketsNeeded,
        hoursNeeded,
        confidence: forecast.confidence || null,
        notes: forecast.notes || null,
        source: forecast.source || "manual",
      },
      update: {
        ticketsNeeded,
        hoursNeeded,
        confidence: forecast.confidence || null,
        notes: forecast.notes || null,
        source: forecast.source || "manual",
      },
    });
    results.push(result);
  }

  return NextResponse.json({ success: true, count: results.length });
}
