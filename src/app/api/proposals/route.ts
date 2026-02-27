import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "pending";

  const proposals = await db.systemProposal.findMany({
    where: { status },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    proposals: proposals.map((p) => ({
      ...p,
      evidence: p.evidence ? JSON.parse(p.evidence) : null,
      payload: JSON.parse(p.payload),
    })),
  });
}
