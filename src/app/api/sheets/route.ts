import { NextResponse } from "next/server";
import * as sheets from "@/lib/sheets";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  if (searchParams.get("test") === "true") {
    const connected = await sheets.testConnection();
    return NextResponse.json({ connected });
  }

  try {
    const data = await sheets.getSheetData();
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

export async function POST() {
  // Trigger a snapshot
  const { db } = await import("@/lib/db");
  try {
    const result = await sheets.createSnapshot(db);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
