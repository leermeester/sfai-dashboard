import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPendingItems, type ResolutionType, type ResolutionStatus } from "@/lib/resolution-queue";
import { validateBody, resolutionQuerySchema } from "@/lib/validations";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = {
    status: searchParams.get("status") || undefined,
    type: searchParams.get("type") || undefined,
    limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined,
    offset: searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : undefined,
  };
  const parsed = validateBody(resolutionQuerySchema, raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const items = await getPendingItems(db, {
      type: (parsed.data.type as ResolutionType) || undefined,
      status: parsed.data.status as ResolutionStatus,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
