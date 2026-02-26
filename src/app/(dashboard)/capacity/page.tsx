export const dynamic = "force-dynamic";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/lib/db";
import { DemandForecastForm } from "@/components/forms/demand-forecast-form";
import { CapacityChart } from "@/components/charts/capacity-chart";
import { TeamRosterTable } from "@/components/tables/team-roster";
import { MeetingHoursTable } from "@/components/tables/meeting-hours-table";
import { MeetingSummaryTable } from "@/components/tables/meeting-summary-table";
import { CalendarSyncButton } from "@/components/calendar-sync-button";
import { getCurrentMonth } from "@/lib/utils";

export default async function CapacityPage() {
  const teamMembers = await db.teamMember.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  const customers = await db.customer.findMany({
    where: { isActive: true },
    orderBy: { displayName: "asc" },
  });

  const currentMonth = getCurrentMonth();
  const forecasts = await db.demandForecast.findMany({
    where: { month: currentMonth },
    include: { customer: true, teamMember: true },
  });

  // Fetch meeting hours for current month, grouped by type
  const monthStart = new Date(`${currentMonth}-01`);
  const nextMonth = new Date(monthStart);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  const teamMap = new Map(teamMembers.map((m) => [m.id, m.name]));
  const customerMap = new Map(customers.map((c) => [c.id, c.displayName]));

  // Client meetings — grouped by team member × customer
  const clientAgg = await db.clientMeeting.groupBy({
    by: ["teamMemberId", "customerId"],
    where: {
      date: { gte: monthStart, lt: nextMonth },
      meetingType: "client",
    },
    _sum: { durationMinutes: true },
    _count: { _all: true },
  });

  const clientHours = clientAgg.map((row) => ({
    teamMemberName: teamMap.get(row.teamMemberId) || "Unknown",
    customerName: row.customerId ? customerMap.get(row.customerId) || "Unknown" : "Unknown",
    totalMinutes: row._sum.durationMinutes || 0,
    meetingCount: row._count._all,
  }));

  const clientTeamMembers = [...new Set(clientHours.map((m) => m.teamMemberName))].sort();
  const clientCustomers = [...new Set(clientHours.map((m) => m.customerName))].sort();

  // Sales meetings — grouped by team member (no customer)
  const salesAgg = await db.clientMeeting.groupBy({
    by: ["teamMemberId"],
    where: {
      date: { gte: monthStart, lt: nextMonth },
      meetingType: "sales",
    },
    _sum: { durationMinutes: true },
    _count: { _all: true },
  });

  const salesByMember = salesAgg.map((row) => ({
    teamMemberName: teamMap.get(row.teamMemberId) || "Unknown",
    totalMinutes: row._sum.durationMinutes || 0,
    meetingCount: row._count._all,
  }));

  // Internal meetings — grouped by team member
  const internalAgg = await db.clientMeeting.groupBy({
    by: ["teamMemberId"],
    where: {
      date: { gte: monthStart, lt: nextMonth },
      meetingType: "internal",
    },
    _sum: { durationMinutes: true },
    _count: { _all: true },
  });

  const internalByMember = internalAgg.map((row) => ({
    teamMemberName: teamMap.get(row.teamMemberId) || "Unknown",
    totalMinutes: row._sum.durationMinutes || 0,
    meetingCount: row._count._all,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Capacity Planning
        </h2>
        <p className="text-muted-foreground">
          Map team capacity against demand.
        </p>
      </div>

      {/* Capacity vs Demand Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Planned Time</CardTitle>
          <CardDescription>
            Forecasted hours per team member, by customer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CapacityChart
            teamMembers={teamMembers.map((m) => ({
              id: m.id,
              name: m.name,
            }))}
            forecasts={forecasts.map((f) => ({
              teamMemberId: f.teamMemberId,
              customerName: f.customer.displayName,
              hoursNeeded: f.hoursNeeded,
              forecastType: f.forecastType,
            }))}
          />
        </CardContent>
      </Card>

      {/* Meeting Hours by Category */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Meeting Hours</CardTitle>
              <CardDescription>
                Time spent in meetings this month ({currentMonth}).
              </CardDescription>
            </div>
            <CalendarSyncButton />
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="client">
            <TabsList>
              <TabsTrigger value="client">Client</TabsTrigger>
              <TabsTrigger value="sales">Sales</TabsTrigger>
              <TabsTrigger value="internal">Internal</TabsTrigger>
            </TabsList>
            <TabsContent value="client" className="mt-4">
              <MeetingHoursTable
                meetings={clientHours}
                teamMembers={clientTeamMembers}
                customers={clientCustomers}
              />
            </TabsContent>
            <TabsContent value="sales" className="mt-4">
              <MeetingSummaryTable
                meetings={salesByMember}
                emptyMessage="No sales meetings synced yet."
              />
            </TabsContent>
            <TabsContent value="internal" className="mt-4">
              <MeetingSummaryTable
                meetings={internalByMember}
                emptyMessage="No internal meetings synced yet."
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Demand Forecast Forms */}
      <Card>
        <CardHeader>
          <CardTitle>Demand Forecast</CardTitle>
          <CardDescription>
            Estimate hours needed per customer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="this_week">
            <TabsList>
              <TabsTrigger value="this_week">This Week</TabsTrigger>
              <TabsTrigger value="next_week">Next Week</TabsTrigger>
            </TabsList>
            <TabsContent value="this_week" className="mt-4">
              <DemandForecastForm
                forecastType="this_week"
                customers={customers.map((c) => ({
                  id: c.id,
                  displayName: c.displayName,
                }))}
                teamMembers={teamMembers.map((m) => ({
                  id: m.id,
                  name: m.name,
                }))}
                existingForecasts={forecasts
                  .filter((f) => f.forecastType === "this_week")
                  .map((f) => ({
                    id: f.id,
                    customerId: f.customerId,
                    teamMemberId: f.teamMemberId,
                    hoursNeeded: f.hoursNeeded,
                    confidence: f.confidence,
                    notes: f.notes,
                  }))}
              />
            </TabsContent>
            <TabsContent value="next_week" className="mt-4">
              <DemandForecastForm
                forecastType="next_week"
                customers={customers.map((c) => ({
                  id: c.id,
                  displayName: c.displayName,
                }))}
                teamMembers={teamMembers.map((m) => ({
                  id: m.id,
                  name: m.name,
                }))}
                existingForecasts={(() => {
                  const longTerm = forecasts.filter((f) => f.forecastType === "next_week");
                  const source = longTerm.length > 0 ? longTerm : forecasts.filter((f) => f.forecastType === "this_week");
                  return source.map((f) => ({
                    id: f.id,
                    customerId: f.customerId,
                    teamMemberId: f.teamMemberId,
                    hoursNeeded: f.hoursNeeded,
                    confidence: f.confidence,
                    notes: f.notes,
                  }));
                })()}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Team Roster */}
      <Card>
        <CardHeader>
          <CardTitle>Team Roster</CardTitle>
          <CardDescription>
            Current team members and their roles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TeamRosterTable
            members={teamMembers.map((m) => ({
              id: m.id,
              name: m.name,
              role: m.role,
              monthlyCost: m.monthlyCost,
              hourlyRate: m.hourlyRate,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
