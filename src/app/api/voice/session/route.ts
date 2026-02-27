import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateVoiceSession } from "@/lib/voice";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "10", 10);

  try {
    const session = await generateVoiceSession(db, limit);
    return NextResponse.json(session);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
