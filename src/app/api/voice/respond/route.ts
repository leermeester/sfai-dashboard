import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { processVoiceResponse } from "@/lib/voice";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { itemId, transcript } = body;

    if (!itemId || !transcript) {
      return NextResponse.json(
        { error: "itemId and transcript are required" },
        { status: 400 }
      );
    }

    const result = await processVoiceResponse(db, itemId, transcript);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
