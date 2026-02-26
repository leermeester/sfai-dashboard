"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface MeetingHour {
  teamMemberName: string;
  customerName: string;
  totalMinutes: number;
  meetingCount: number;
}

interface Props {
  meetings: MeetingHour[];
  teamMembers: string[];
  customers: string[];
}

export function MeetingHoursTable({ meetings, teamMembers, customers }: Props) {
  if (meetings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No client meetings synced yet. Set customer email domains in Settings,
        then sync calendar data.
      </p>
    );
  }

  // Build lookup: teamMember → customer → { minutes, count }
  const lookup = new Map<string, Map<string, { minutes: number; count: number }>>();
  for (const m of meetings) {
    if (!lookup.has(m.teamMemberName)) {
      lookup.set(m.teamMemberName, new Map());
    }
    lookup.get(m.teamMemberName)!.set(m.customerName, {
      minutes: m.totalMinutes,
      count: m.meetingCount,
    });
  }

  // Compute totals per team member and per customer
  const teamTotals = new Map<string, number>();
  const customerTotals = new Map<string, number>();
  for (const m of meetings) {
    teamTotals.set(
      m.teamMemberName,
      (teamTotals.get(m.teamMemberName) || 0) + m.totalMinutes
    );
    customerTotals.set(
      m.customerName,
      (customerTotals.get(m.customerName) || 0) + m.totalMinutes
    );
  }

  function formatHours(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-medium">Team Member</TableHead>
            {customers.map((c) => (
              <TableHead key={c} className="text-center text-xs">
                {c}
              </TableHead>
            ))}
            <TableHead className="text-center font-medium">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {teamMembers.map((tm) => (
            <TableRow key={tm}>
              <TableCell className="font-medium text-sm">{tm}</TableCell>
              {customers.map((c) => {
                const data = lookup.get(tm)?.get(c);
                return (
                  <TableCell
                    key={c}
                    className="text-center tabular-nums text-sm"
                    title={data ? `${data.count} meeting${data.count > 1 ? "s" : ""}` : undefined}
                  >
                    {data ? formatHours(data.minutes) : "-"}
                  </TableCell>
                );
              })}
              <TableCell className="text-center tabular-nums text-sm font-medium">
                {formatHours(teamTotals.get(tm) || 0)}
              </TableCell>
            </TableRow>
          ))}
          {/* Totals row */}
          <TableRow className="border-t-2">
            <TableCell className="font-medium text-sm">Total</TableCell>
            {customers.map((c) => (
              <TableCell
                key={c}
                className="text-center tabular-nums text-sm font-medium"
              >
                {formatHours(customerTotals.get(c) || 0)}
              </TableCell>
            ))}
            <TableCell className="text-center tabular-nums text-sm font-bold">
              {formatHours(
                Array.from(teamTotals.values()).reduce((a, b) => a + b, 0)
              )}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
