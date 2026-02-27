import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleInteraction, verifySlackSignature } from "@/lib/slack";

export async function POST(request: Request) {
  const body = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp") || "";
  const signature = request.headers.get("x-slack-signature") || "";

  // Verify signature
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (signingSecret) {
    const valid = verifySlackSignature(signingSecret, timestamp, body, signature);
    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  // Parse the payload (Slack sends form-encoded for interactive messages)
  let payload;
  try {
    const params = new URLSearchParams(body);
    const payloadStr = params.get("payload");
    if (payloadStr) {
      payload = JSON.parse(payloadStr);
    } else {
      payload = JSON.parse(body);
    }
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Handle URL verification challenge
  if (payload.type === "url_verification") {
    return NextResponse.json({ challenge: payload.challenge });
  }

  // Handle interactive message
  if (payload.type === "block_actions") {
    try {
      const result = await handleInteraction(db, payload);
      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}
