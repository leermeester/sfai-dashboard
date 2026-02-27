import type { PrismaClient } from "@prisma/client";
import type { ResolutionType, ResolveDecision } from "./resolution-queue";

/**
 * Generate proposals after a resolution decision.
 * Proposals are staged rules that require user approval before becoming active.
 */
export async function generateProposals(
  db: PrismaClient,
  type: ResolutionType,
  sourceEntity: string,
  decision: ResolveDecision,
  resolutionItemId: string
): Promise<void> {
  switch (type) {
    case "customer_match":
      await proposeAlias(db, sourceEntity, decision, resolutionItemId);
      break;
    case "engineer_split":
      // No pattern to learn from engineer splits
      break;
  }

  // Generate suppression proposals for rejections
  if (decision.action === "reject") {
    await proposeSuppression(db, type, sourceEntity, resolutionItemId);
  }
}

/**
 * When a customer_match is confirmed, propose adding the sourceEntity as a customer alias.
 * This helps future transactions from the same counterparty auto-match.
 */
async function proposeAlias(
  db: PrismaClient,
  sourceEntity: string,
  decision: ResolveDecision,
  resolutionItemId: string
): Promise<void> {
  if (decision.action !== "approve" || !decision.customerId) return;

  const customer = await db.customer.findUnique({
    where: { id: decision.customerId },
    select: { id: true, displayName: true, bankName: true, aliases: true },
  });
  if (!customer) return;

  const normalized = sourceEntity.toLowerCase();

  // Skip if already matched (bankName, alias, or displayName)
  if (customer.bankName?.toLowerCase() === normalized) return;
  if (customer.aliases.some((a) => a.toLowerCase() === normalized)) return;
  if (customer.displayName.toLowerCase() === normalized) return;

  // Check if proposal already exists
  const existing = await db.systemProposal.findFirst({
    where: {
      type: "alias",
      status: "pending",
      payload: { contains: normalized },
    },
  });
  if (existing) return;

  await db.systemProposal.create({
    data: {
      type: "alias",
      description: `Add "${sourceEntity}" as alias for customer "${customer.displayName}"`,
      evidence: JSON.stringify({
        sourceEntity,
        resolutionCount: 1,
        resolutionItemId,
      }),
      payload: JSON.stringify({
        customerId: customer.id,
        customerName: customer.displayName,
        alias: normalized,
      }),
      sourceItemId: resolutionItemId,
    },
  });
}

/**
 * When a match is rejected, propose a suppression rule to prevent the same suggestion.
 */
async function proposeSuppression(
  db: PrismaClient,
  type: ResolutionType,
  sourceEntity: string,
  resolutionItemId: string
): Promise<void> {
  // Get the resolution item to find what was suggested
  const item = await db.resolutionItem.findUnique({
    where: { id: resolutionItemId },
  });
  if (!item?.suggestedMatch) return;

  const suggested = JSON.parse(item.suggestedMatch);
  if (!suggested.id && !suggested.label) return;

  const existing = await db.systemProposal.findFirst({
    where: {
      type: "suppression",
      status: "pending",
      payload: { contains: sourceEntity.toLowerCase() },
    },
  });
  if (existing) return;

  await db.systemProposal.create({
    data: {
      type: "suppression",
      description: `Never suggest "${suggested.label || suggested.id}" for "${sourceEntity}" (${type})`,
      evidence: JSON.stringify({
        sourceEntity,
        rejectedMatch: suggested,
        resolutionType: type,
        resolutionItemId,
      }),
      payload: JSON.stringify({
        sourcePattern: sourceEntity.toLowerCase(),
        targetId: suggested.id,
        targetLabel: suggested.label,
        resolutionType: type,
      }),
      sourceItemId: resolutionItemId,
    },
  });
}
