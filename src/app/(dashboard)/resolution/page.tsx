export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { ResolutionQueue } from "./resolution-queue";

export default async function ResolutionPage() {
  const [customers, teamMembers] = await Promise.all([
    db.customer.findMany({
      where: { isActive: true },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    }),
    db.teamMember.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return <ResolutionQueue customers={customers} teamMembers={teamMembers} />;
}
