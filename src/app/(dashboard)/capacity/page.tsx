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

      {/* Capacity vs Demand Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Capacity vs Demand</CardTitle>
          <CardDescription>
            Hours allocated per team member for {currentMonth}.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[350px]">
          <CapacityChart
            teamMembers={teamMembers.map((m) => ({
              id: m.id,
              name: m.name,
            }))}
            forecasts={forecasts.map((f) => ({
              teamMemberId: f.teamMemberId,
              customerName: f.customer.displayName,
              hoursNeeded: f.hoursNeeded,
            }))}
          />
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
          <Tabs defaultValue="short_term">
            <TabsList>
              <TabsTrigger value="short_term">
                Short-term (2 weeks)
              </TabsTrigger>
              <TabsTrigger value="long_term">Long-term</TabsTrigger>
            </TabsList>
            <TabsContent value="short_term" className="mt-4">
              <DemandForecastForm
                forecastType="short_term"
                customers={customers.map((c) => ({
                  id: c.id,
                  displayName: c.displayName,
                }))}
                teamMembers={teamMembers.map((m) => ({
                  id: m.id,
                  name: m.name,
                }))}
                existingForecasts={forecasts
                  .filter((f) => f.forecastType === "short_term")
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
            <TabsContent value="long_term" className="mt-4">
              <DemandForecastForm
                forecastType="long_term"
                customers={customers.map((c) => ({
                  id: c.id,
                  displayName: c.displayName,
                }))}
                teamMembers={teamMembers.map((m) => ({
                  id: m.id,
                  name: m.name,
                }))}
                existingForecasts={forecasts
                  .filter((f) => f.forecastType === "long_term")
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
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
