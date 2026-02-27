import type { PrismaClient } from "@prisma/client";
import { fetchWithRetry } from "./fetch-with-retry";
import type { Logger } from "./logger";

export interface CalendarEvent {
  eventId: string;
  date: string; // "2026-01-15"
  startTime: string; // "14:00"
  endTime: string; // "15:00"
  durationMinutes: number;
  title: string;
  organizerEmail: string; // internal team member email
  attendeeEmails: string[];
  externalDomains: string[];
}

/**
 * Fetches calendar event data from the Google Sheet exported by the Apps Script.
 */
export async function getCalendarSheetData(logger?: Logger): Promise<CalendarEvent[]> {
  const sheetId = process.env.GOOGLE_CALENDAR_SHEET_ID;
  if (!sheetId) throw new Error("GOOGLE_CALENDAR_SHEET_ID not set");

  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
  const res = await fetchWithRetry(url, undefined, { logger });
  if (!res.ok)
    throw new Error(`Calendar sheet fetch failed: ${res.status}`);

  const csv = await res.text();
  const rows = parseCsv(csv);
  if (rows.length < 2) return [];

  return parseCalendarEvents(rows);
}

/**
 * Parses CSV rows into typed CalendarEvent objects.
 * Expected header: event_id, date, start_time, end_time, duration_minutes,
 *                  title, organizer_email, attendee_emails, external_domains
 */
export function parseCalendarEvents(rows: string[][]): CalendarEvent[] {
  const header = rows[0].map((h) => h.trim().toLowerCase());

  const col = (name: string) => header.indexOf(name);
  const iEventId = col("event_id");
  const iDate = col("date");
  const iStart = col("start_time");
  const iEnd = col("end_time");
  const iDuration = col("duration_minutes");
  const iTitle = col("title");
  const iOrganizer = col("organizer_email");
  const iAttendees = col("attendee_emails");
  const iDomains = col("external_domains");

  if (iEventId === -1 || iDate === -1 || iOrganizer === -1) {
    throw new Error(
      "Calendar sheet missing required columns (event_id, date, organizer_email)"
    );
  }

  const events: CalendarEvent[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const eventId = row[iEventId]?.trim();
    const date = row[iDate]?.trim();
    const organizerEmail = row[iOrganizer]?.trim();

    if (!eventId || !date || !organizerEmail) continue;

    const durationMinutes =
      iDuration !== -1 ? parseInt(row[iDuration]?.trim() || "0", 10) : 0;

    events.push({
      eventId,
      date,
      startTime: iStart !== -1 ? row[iStart]?.trim() || "" : "",
      endTime: iEnd !== -1 ? row[iEnd]?.trim() || "" : "",
      durationMinutes,
      title: iTitle !== -1 ? row[iTitle]?.trim() || "" : "",
      organizerEmail,
      attendeeEmails:
        iAttendees !== -1
          ? (row[iAttendees] || "")
              .split(",")
              .map((e) => e.trim())
              .filter(Boolean)
          : [],
      externalDomains:
        iDomains !== -1
          ? (row[iDomains] || "")
              .split(",")
              .map((d) => d.trim())
              .filter(Boolean)
          : [],
    });
  }

  return events;
}

/**
 * Syncs calendar events into ClientMeeting records.
 * Categorizes each meeting as:
 *   - "client"   — external attendees match a known customer email domain
 *   - "sales"    — external attendees present but no customer match (prospects)
 *   - "internal" — all attendees are @sfaiconsultants.com
 */
export async function syncMeetings(db: PrismaClient, logger?: Logger) {
  const startTime = Date.now();
  logger?.info("Calendar sync started");
  const events = await getCalendarSheetData(logger);
  logger?.info("Calendar events fetched", { count: events.length });

  const customers = await db.customer.findMany({
    where: { isActive: true },
    select: { id: true, emailDomain: true, aliases: true, displayName: true },
  });

  const teamMembers = await db.teamMember.findMany({
    where: { isActive: true },
    select: { id: true, email: true, name: true },
  });

  // Build domain → customer lookup
  const domainToCustomer = new Map<string, string>();
  for (const c of customers) {
    if (c.emailDomain) {
      domainToCustomer.set(c.emailDomain.toLowerCase(), c.id);
    }
  }

  // Build domain mapping lookup (user-configured overrides)
  const domainMappings = await db.domainMapping.findMany();
  const domainToMapping = new Map<
    string,
    { meetingType: string; customerId: string | null }
  >();
  for (const m of domainMappings) {
    domainToMapping.set(m.domain.toLowerCase(), {
      meetingType: m.meetingType,
      customerId: m.customerId,
    });
  }

  // Build email → team member lookup
  const emailToTeamMember = new Map<string, string>();
  for (const m of teamMembers) {
    if (m.email) {
      emailToTeamMember.set(m.email.toLowerCase(), m.id);
    }
  }

  let created = 0;
  const updated = 0;
  let skippedNoTeamMember = 0;
  let skippedIgnored = 0;
  const counts = { client: 0, sales: 0, internal: 0 };
  const unmatchedDomains = new Set<string>();
  const meetingUpserts: { eventId: string; data: {
    meetingType: string;
    customerId: string | null;
    teamMemberId: string;
    date: Date;
    durationMinutes: number;
    title: string;
    attendeeEmails: string[];
    externalDomains: string[];
  } }[] = [];

  for (const event of events) {
    // Find team member by organizer email
    const teamMemberId = emailToTeamMember.get(
      event.organizerEmail.toLowerCase()
    );
    if (!teamMemberId) {
      skippedNoTeamMember++;
      continue;
    }

    // Determine meeting type and customer
    let meetingType: "client" | "sales" | "internal" = "sales";
    let customerId: string | null = null;

    if (event.externalDomains.length === 0) {
      // No external attendees → internal meeting
      meetingType = "internal";
    } else {
      // 1. Try to match external domains to a customer via emailDomain
      for (const domain of event.externalDomains) {
        const match = domainToCustomer.get(domain.toLowerCase());
        if (match) {
          customerId = match;
          break;
        }
      }

      if (customerId) {
        meetingType = "client";
      } else {
        // 2. Check domain mappings (user-configured overrides)
        let mapped = false;
        let ignored = false;
        for (const domain of event.externalDomains) {
          const mapping = domainToMapping.get(domain.toLowerCase());
          if (mapping) {
            if (mapping.meetingType === "ignore") {
              ignored = true;
              break;
            }
            meetingType = mapping.meetingType as "client" | "sales" | "internal";
            if (mapping.meetingType === "client" && mapping.customerId) {
              customerId = mapping.customerId;
            }
            mapped = true;
            break;
          }
        }

        if (ignored) {
          skippedIgnored++;
          continue;
        }

        if (!mapped) {
          // 3. Default: unmatched external domains → sales
          meetingType = "sales";
          for (const d of event.externalDomains) {
            if (!domainToMapping.has(d.toLowerCase())) {
              unmatchedDomains.add(d);
            }
          }
        }
      }
    }

    counts[meetingType]++;

    meetingUpserts.push({
      eventId: event.eventId,
      data: {
        meetingType,
        customerId,
        teamMemberId,
        date: new Date(event.date),
        durationMinutes: event.durationMinutes,
        title: event.title,
        attendeeEmails: event.attendeeEmails,
        externalDomains: event.externalDomains,
      },
    });
  }

  // Batch upsert meetings in groups of 50
  const BATCH_SIZE = 50;
  for (let i = 0; i < meetingUpserts.length; i += BATCH_SIZE) {
    const batch = meetingUpserts.slice(i, i + BATCH_SIZE);
    await db.$transaction(
      batch.map(({ eventId, data }) =>
        db.clientMeeting.upsert({
          where: { googleEventId: eventId },
          create: { googleEventId: eventId, ...data },
          update: { ...data, syncedAt: new Date() },
        })
      )
    );
    created += batch.length; // approximate — upserts may be creates or updates
  }

  // Unmatched domains are logged but not queued for resolution.
  // Users classify domains via Settings > Domains.
  if (unmatchedDomains.size > 0) {
    logger?.warn("Unmatched calendar domains — classify in Settings > Domains", {
      domains: Array.from(unmatchedDomains),
    });
  }

  logger?.info("Calendar sync completed", {
    total: events.length,
    created,
    updated,
    skippedNoTeamMember,
    skippedIgnored,
    counts,
    unmatchedDomains: unmatchedDomains.size,
    durationMs: Date.now() - startTime,
  });

  return {
    total: events.length,
    created,
    updated,
    skippedNoTeamMember,
    skippedIgnored,
    counts,
    unmatchedDomains: Array.from(unmatchedDomains),
  };
}

export async function testConnection(): Promise<boolean> {
  try {
    const data = await getCalendarSheetData();
    return data.length >= 0;
  } catch {
    return false;
  }
}

// ---------- CSV parser (same as sheets.ts) ----------

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (inQuotes) {
      if (ch === '"' && csv[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(current);
        current = "";
      } else if (ch === "\n" || (ch === "\r" && csv[i + 1] === "\n")) {
        row.push(current);
        current = "";
        rows.push(row);
        row = [];
        if (ch === "\r") i++;
      } else {
        current += ch;
      }
    }
  }
  if (current || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows;
}
