/**
 * Google Apps Script — paste this into the Apps Script editor
 * (Extensions > Apps Script) of the "Meeting accounting" Google Sheet.
 *
 * It exports Google Calendar events to Sheet1 with columns matching
 * the dashboard's calendar.ts parser:
 *   event_id, date, start_time, end_time, duration_minutes,
 *   title, organizer_email, attendee_emails, external_domains
 *
 * Setup:
 *   1. Paste this into the Apps Script editor
 *   2. Run exportCalendarEvents() once manually to authorize
 *   3. (Optional) Add a time-driven trigger to run daily
 */

// Your company email domain — used to identify external attendees
var INTERNAL_DOMAIN = "sfaiconsultants.com";

// How many days back to export (from today)
var DAYS_BACK = 90;

// How many days forward to export
var DAYS_FORWARD = 30;

function exportCalendarEvents() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sheet1");
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  }

  // Clear existing data
  sheet.clearContents();

  // Write header row
  var headers = [
    "event_id",
    "date",
    "start_time",
    "end_time",
    "duration_minutes",
    "title",
    "organizer_email",
    "attendee_emails",
    "external_domains",
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Date range
  var now = new Date();
  var startDate = new Date(now);
  startDate.setDate(startDate.getDate() - DAYS_BACK);
  var endDate = new Date(now);
  endDate.setDate(endDate.getDate() + DAYS_FORWARD);

  // Get all calendars the user has access to
  var calendars = CalendarApp.getAllCalendars();
  var rows = [];
  var seenEventIds = {};

  for (var c = 0; c < calendars.length; c++) {
    var cal = calendars[c];

    // Only process owned calendars (skip subscribed/holiday calendars)
    if (!cal.isOwnedByMe()) continue;

    var events = cal.getEvents(startDate, endDate);

    for (var i = 0; i < events.length; i++) {
      var event = events[i];
      var eventId = event.getId();

      // Skip duplicates (same event can appear on multiple calendars)
      if (seenEventIds[eventId]) continue;
      seenEventIds[eventId] = true;

      // Skip all-day events (not meetings)
      if (event.isAllDayEvent()) continue;

      var guestList = event.getGuestList(true); // include organizer
      var attendeeEmails = [];
      var externalDomains = {};

      for (var g = 0; g < guestList.length; g++) {
        var email = guestList[g].getEmail().toLowerCase();
        if (!email) continue;
        attendeeEmails.push(email);

        var domain = email.split("@")[1];
        if (domain && domain !== INTERNAL_DOMAIN) {
          externalDomains[domain] = true;
        }
      }

      var start = event.getStartTime();
      var end = event.getEndTime();
      var durationMs = end.getTime() - start.getTime();
      var durationMinutes = Math.round(durationMs / 60000);

      // Determine organizer email
      var organizerEmail = "";
      var creators = event.getCreators();
      if (creators && creators.length > 0) {
        organizerEmail = creators[0].toLowerCase();
      }

      // Format date as YYYY-MM-DD
      var dateStr = Utilities.formatDate(start, Session.getScriptTimeZone(), "yyyy-MM-dd");
      var startTime = Utilities.formatDate(start, Session.getScriptTimeZone(), "HH:mm");
      var endTime = Utilities.formatDate(end, Session.getScriptTimeZone(), "HH:mm");

      rows.push([
        eventId,
        dateStr,
        startTime,
        endTime,
        durationMinutes,
        event.getTitle(),
        organizerEmail,
        attendeeEmails.join(","),
        Object.keys(externalDomains).join(","),
      ]);
    }
  }

  // Write all rows at once (much faster than row-by-row)
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  Logger.log("Exported " + rows.length + " events");
}
