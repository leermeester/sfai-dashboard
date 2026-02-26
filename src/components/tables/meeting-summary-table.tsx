"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface MeetingSummary {
  teamMemberName: string;
  totalMinutes: number;
  meetingCount: number;
}

interface Props {
  meetings: MeetingSummary[];
  emptyMessage?: string;
}

export function MeetingSummaryTable({ meetings, emptyMessage }: Props) {
  if (meetings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {emptyMessage || "No meetings found."}
      </p>
    );
  }

  function formatHours(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  const totalMinutes = meetings.reduce((sum, m) => sum + m.totalMinutes, 0);
  const totalCount = meetings.reduce((sum, m) => sum + m.meetingCount, 0);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Team Member</TableHead>
          <TableHead className="text-center">Meetings</TableHead>
          <TableHead className="text-center">Total Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {meetings.map((m) => (
          <TableRow key={m.teamMemberName}>
            <TableCell className="font-medium text-sm">
              {m.teamMemberName}
            </TableCell>
            <TableCell className="text-center tabular-nums text-sm">
              {m.meetingCount}
            </TableCell>
            <TableCell className="text-center tabular-nums text-sm">
              {formatHours(m.totalMinutes)}
            </TableCell>
          </TableRow>
        ))}
        <TableRow className="border-t-2">
          <TableCell className="font-medium text-sm">Total</TableCell>
          <TableCell className="text-center tabular-nums text-sm font-medium">
            {totalCount}
          </TableCell>
          <TableCell className="text-center tabular-nums text-sm font-bold">
            {formatHours(totalMinutes)}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
