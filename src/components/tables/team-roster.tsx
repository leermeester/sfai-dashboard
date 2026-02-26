"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  monthlyCost: number | null;
  hourlyRate: number | null;
}

export function TeamRosterTable({ members }: { members: TeamMember[] }) {
  if (members.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No team members configured. Add them in Settings.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Role</TableHead>
          <TableHead className="text-right">Monthly Cost</TableHead>
          <TableHead className="text-right">Hourly Rate</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((m) => (
          <TableRow key={m.id}>
            <TableCell className="font-medium">{m.name}</TableCell>
            <TableCell>
              <Badge variant="outline">{m.role}</Badge>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {m.monthlyCost ? formatCurrency(m.monthlyCost) : "-"}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {m.hourlyRate ? `${formatCurrency(m.hourlyRate)}/hr` : "-"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
