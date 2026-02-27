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
import { DomainMappingForm } from "@/components/forms/domain-mapping-form";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const defaultTab = params.tab ?? "customers";
  const customers = await db.customer.findMany({
    orderBy: { displayName: "asc" },
  });

  const teamMembers = await db.teamMember.findMany({
    orderBy: { name: "asc" },
  });

  // Domain mapping data: count external domains from synced meetings
  const domainCounts = new Map<string, number>();
  const meetings = await db.clientMeeting.findMany({
    select: { externalDomains: true },
    where: { externalDomains: { isEmpty: false } },
  });
  for (const m of meetings) {
    for (const d of m.externalDomains) {
      const domain = d.toLowerCase();
      domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
    }
  }
  // Exclude domains already assigned to a customer's emailDomain
  const assignedDomains = new Set(
    customers
      .filter((c) => c.emailDomain)
      .map((c) => c.emailDomain!.toLowerCase())
  );
  const unmatchedDomains = Array.from(domainCounts.entries())
    .filter(([domain]) => !assignedDomains.has(domain))
    .sort((a, b) => b[1] - a[1])
    .map(([domain, count]) => ({ domain, meetingCount: count }));

  const existingDomainMappings = await db.domainMapping.findMany({
    orderBy: { domain: "asc" },
  });

  // Include mapped domains that aren't in the unmatched list (already mapped)
  const unmatchedSet = new Set(unmatchedDomains.map((d) => d.domain));
  for (const mapping of existingDomainMappings) {
    if (!unmatchedSet.has(mapping.domain)) {
      const count = domainCounts.get(mapping.domain) ?? 0;
      unmatchedDomains.push({ domain: mapping.domain, meetingCount: count });
    }
  }
  unmatchedDomains.sort((a, b) => b.meetingCount - a.meetingCount);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Configure team, customers, and integrations.
        </p>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="domains">Domains</TabsTrigger>
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
                  emailDomain: c.emailDomain,
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
                  mercuryCounterparty: m.mercuryCounterparty,
                }))}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="domains" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Domain Mapping</CardTitle>
              <CardDescription>
                Classify external email domains from calendar meetings. Use
                keyboard shortcuts for fast navigation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DomainMappingForm
                domains={unmatchedDomains}
                existingMappings={existingDomainMappings.map((m) => ({
                  id: m.id,
                  domain: m.domain,
                  meetingType: m.meetingType,
                  customerId: m.customerId,
                }))}
                customers={customers
                  .filter((c) => c.isActive)
                  .map((c) => ({
                    id: c.id,
                    displayName: c.displayName,
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
