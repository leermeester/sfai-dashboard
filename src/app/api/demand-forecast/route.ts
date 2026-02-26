import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMonth } from "@/lib/utils";

export async function PUT(request: Request) {
  const { forecasts, forecastType } = await request.json();
  const month = getCurrentMonth();

  // Delete existing forecasts of this type for the current month
  await db.demandForecast.deleteMany({
    where: { month, forecastType },
  });

  // Create new forecasts
  for (const forecast of forecasts) {
    await db.demandForecast.create({
      data: {
        customerId: forecast.customerId,
        teamMemberId: forecast.teamMemberId || null,
        month,
        forecastType,
        hoursNeeded: forecast.hoursNeeded,
        confidence: forecast.confidence,
        notes: forecast.notes,
      },
    });
  }

  return NextResponse.json({ success: true });
}
