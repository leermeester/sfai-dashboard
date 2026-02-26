import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as calendar from "@/lib/calendar";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  if (searchParams.get("test") === "true") {
    const connected = await calendar.testConnection();
    return NextResponse.json({ connected });
  }

  if (searchParams.get("domains") === "true") {
    // Try DB first, fall back to fetching calendar sheet directly
    const domainCounts = new Map<string, number>();

    const meetings = await db.clientMeeting.findMany({
      select: { externalDomains: true },
      where: { externalDomains: { isEmpty: false } },
    });

    if (meetings.length > 0) {
      for (const m of meetings) {
        for (const d of m.externalDomains) {
          const domain = d.toLowerCase();
          domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
        }
      }
    } else {
      // No synced meetings — pull directly from calendar sheet
      try {
        const events = await calendar.getCalendarSheetData();
        for (const e of events) {
          for (const d of e.externalDomains) {
            const domain = d.toLowerCase();
            domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
          }
        }
      } catch {
        // Calendar sheet not available
      }
    }

    // Exclude domains already assigned to a customer
    const customers = await db.customer.findMany({
      select: { emailDomain: true },
      where: { emailDomain: { not: null } },
    });
    const assignedDomains = new Set(
      customers.map((c) => c.emailDomain!.toLowerCase())
    );

    const domains = Array.from(domainCounts.entries())
      .filter(([domain]) => !assignedDomains.has(domain))
      .sort((a, b) => b[1] - a[1])
      .map(([domain, count]) => ({ domain, meetingCount: count }));

    return NextResponse.json({ domains });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

export async function POST() {
  try {
    const result = await calendar.syncMeetings(db);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
