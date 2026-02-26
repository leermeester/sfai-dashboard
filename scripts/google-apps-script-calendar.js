/**
 * SFAI Dashboard — Google Calendar Export Script
 *
 * This Google Apps Script exports ALL calendar events (with attendee emails)
 * to a Google Sheet that the dashboard reads as CSV.
 * Events are exported regardless of whether they have external attendees —
 * the dashboard categorizes them as client, sales, or internal.
 *
 * SETUP:
 * 1. Go to https://script.google.com and create a new project
 * 2. Paste this entire script into the editor
 * 3. Update CALENDAR_EMAILS below with the calendars to sync
 * 4. Update SHEET_ID with your target Google Sheet ID
 * 5. Run exportCalendarEvents() once to test
 * 6. Add a daily trigger: Edit > Triggers > Add Trigger
 *    - Function: exportCalendarEvents
 *    - Event source: Time-driven
 *    - Type: Day timer
 *    - Time: 6am-7am
 */

// ============ CONFIGURATION ============

// Calendars to sync (email addresses)
const CALENDAR_EMAILS = [
  "dj@sfaiconsultants.com",
  "arthur@sfaiconsultants.com",
];

// The Google Sheet ID where events will be written
// (create a new sheet and paste its ID here)
const SHEET_ID = "YOUR_SHEET_ID_HERE";

// Sheet tab name
const TAB_NAME = "Calendar Events";

// How far back and forward to look
const DAYS_BACK = 90;
const DAYS_FORWARD = 30;

// Internal domain to exclude from attendee matching
const INTERNAL_DOMAIN = "sfaiconsultants.com";

// ============ MAIN FUNCTION ============

function exportCalendarEvents() {
  const sheet = getOrCreateSheet();
  const events = getAllEvents();

  // Clear existing data and write header
  sheet.clear();
  sheet.appendRow([
    "event_id",
    "date",
    "start_time",
    "end_time",
    "duration_minutes",
    "title",
    "organizer_email",
    "attendee_emails",
    "external_domains",
  ]);

  // Write event rows
  for (const event of events) {
    sheet.appendRow([
      event.eventId,
      event.date,
      event.startTime,
      event.endTime,
      event.durationMinutes,
      event.title,
      event.organizerEmail,
      event.attendeeEmails.join(", "),
      event.externalDomains.join(", "),
    ]);
  }

  Logger.log(
    "Exported " + events.length + " events (client + sales + internal)"
  );
}

// ============ HELPERS ============

function getOrCreateSheet() {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  let sheet = spreadsheet.getSheetByName(TAB_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(TAB_NAME);
  }
  return sheet;
}

function getAllEvents() {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - DAYS_BACK);
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + DAYS_FORWARD);

  const allEvents = [];
  const seenEventIds = new Set();

  for (const email of CALENDAR_EMAILS) {
    try {
      const calendar = CalendarApp.getCalendarById(email);
      if (!calendar) {
        Logger.log("Calendar not found: " + email);
        continue;
      }

      const events = calendar.getEvents(startDate, endDate);
      Logger.log("Found " + events.length + " events for " + email);

      for (const event of events) {
        const eventId = event.getId();

        // Deduplicate across calendars (same event appears on multiple)
        if (seenEventIds.has(eventId)) continue;
        seenEventIds.add(eventId);

        const guests = event.getGuestList(true);
        const attendeeEmails = guests.map(function (g) {
          return g.getEmail();
        });

        // Also include the organizer
        const allAttendees = attendeeEmails.slice();
        const creatorEmail = event.getCreators()[0];
        if (creatorEmail && allAttendees.indexOf(creatorEmail) === -1) {
          allAttendees.push(creatorEmail);
        }

        // Find external domains
        const externalDomains = [];
        const seenDomains = new Set();
        for (const attendeeEmail of allAttendees) {
          const domain = attendeeEmail.split("@")[1];
          if (domain && domain !== INTERNAL_DOMAIN && !seenDomains.has(domain)) {
            seenDomains.add(domain);
            externalDomains.push(domain);
          }
        }

        const start = event.getStartTime();
        const end = event.getEndTime();
        const durationMs = end.getTime() - start.getTime();
        const durationMinutes = Math.round(durationMs / 60000);

        // Figure out which internal team members are on this event
        var internalAttendees = allAttendees.filter(function (e) {
          return e.endsWith("@" + INTERNAL_DOMAIN);
        });

        // If no attendees at all (solo calendar block), attribute to the calendar owner
        if (internalAttendees.length === 0) {
          internalAttendees = [email];
        }

        // Create one row per internal attendee (so we can attribute time per person)
        for (const internalEmail of internalAttendees) {
          allEvents.push({
            eventId: eventId + "_" + internalEmail,
            date: Utilities.formatDate(start, "UTC", "yyyy-MM-dd"),
            startTime: Utilities.formatDate(start, "UTC", "HH:mm"),
            endTime: Utilities.formatDate(end, "UTC", "HH:mm"),
            durationMinutes: durationMinutes,
            title: event.getTitle(),
            organizerEmail: internalEmail,
            attendeeEmails: allAttendees,
            externalDomains: externalDomains,
          });
        }
      }
    } catch (e) {
      Logger.log("Error reading calendar " + email + ": " + e.message);
    }
  }

  return allEvents;
}
