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
import { CustomerMappingForm } from "@/components/forms/customer-mapping-form";
import { TeamConfigForm } from "@/components/forms/team-config-form";
import { ApiStatusPanel } from "@/components/forms/api-status-panel";

export default async function SettingsPage() {
  const customers = await db.customer.findMany({
    orderBy: { displayName: "asc" },
  });

  const teamMembers = await db.teamMember.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Configure team, customers, and integrations.
        </p>
      </div>

      <Tabs defaultValue="customers">
        <TabsList>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer Name Mapping</CardTitle>
              <CardDescription>
                Map customer names across Google Sheets, Mercury, Linear, and
                internal use.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CustomerMappingForm
                customers={customers.map((c) => ({
                  id: c.id,
                  displayName: c.displayName,
                  spreadsheetName: c.spreadsheetName,
                  bankName: c.bankName,
                  linearProjectId: c.linearProjectId,
                  email: c.email,
                  aliases: c.aliases,
                  isActive: c.isActive,
                }))}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Configuration</CardTitle>
              <CardDescription>
                Manage team members, roles, and cost rates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TeamConfigForm
                members={teamMembers.map((m) => ({
                  id: m.id,
                  name: m.name,
                  email: m.email,
                  role: m.role,
                  hourlyRate: m.hourlyRate,
                  monthlyCost: m.monthlyCost,
                  isActive: m.isActive,
                  linearUserId: m.linearUserId,
                }))}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="mt-4">
          <ApiStatusPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
