import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { action } = body;

  if (!action || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }

  const proposal = await db.systemProposal.findUnique({ where: { id } });
  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }
  if (proposal.status !== "pending") {
    return NextResponse.json({ error: `Proposal already ${proposal.status}` }, { status: 409 });
  }

  const payload = JSON.parse(proposal.payload);

  if (action === "approve") {
    // Create the SystemRule and apply the side effect
    await db.$transaction(async (tx) => {
      await tx.systemProposal.update({
        where: { id },
        data: { status: "approved", resolvedAt: new Date() },
      });

      await tx.systemRule.create({
        data: {
          type: proposal.type,
          source: "proposal-approved",
          payload: proposal.payload,
          isActive: true,
        },
      });

      // Apply side effects based on proposal type
      switch (proposal.type) {
        case "alias": {
          if (payload.customerId && payload.alias) {
            const customer = await tx.customer.findUnique({
              where: { id: payload.customerId },
            });
            if (customer && !customer.aliases.includes(payload.alias.toLowerCase())) {
              await tx.customer.update({
                where: { id: payload.customerId },
                data: { aliases: [...customer.aliases, payload.alias.toLowerCase()] },
              });
            }
          }
          break;
        }
        case "vendor_pattern": {
          if (payload.pattern && payload.category) {
            try {
              await tx.vendorCategoryRule.create({
                data: {
                  vendorPattern: (payload.pattern as string).toLowerCase(),
                  category: payload.category as string,
                  displayName: payload.displayName as string || payload.pattern as string,
                },
              });
            } catch {
              // Rule already exists
            }
          }
          break;
        }
        case "domain_mapping": {
          if (payload.domain && payload.meetingType) {
            await tx.domainMapping.upsert({
              where: { domain: (payload.domain as string).toLowerCase() },
              create: {
                domain: (payload.domain as string).toLowerCase(),
                meetingType: payload.meetingType as string,
                customerId: (payload.customerId as string) || null,
              },
              update: {
                meetingType: payload.meetingType as string,
                customerId: (payload.customerId as string) || null,
              },
            });
          }
          break;
        }
        case "suppression": {
          // Suppression rules are stored in SystemRule only, checked during matching
          break;
        }
      }
    }, { timeout: 10000 });

    return NextResponse.json({ resolved: true, status: "approved" });
  } else {
    await db.systemProposal.update({
      where: { id },
      data: { status: "rejected", resolvedAt: new Date() },
    });

    return NextResponse.json({ resolved: true, status: "rejected" });
  }
}
