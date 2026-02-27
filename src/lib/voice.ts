import type { PrismaClient } from "@prisma/client";
import { getPendingItems, resolveItem, type ResolutionChannel, type ResolveDecision } from "./resolution-queue";

// ── Prompt generation ──────────────────────────────────

interface VoicePrompt {
  itemId: string;
  type: string;
  prompt: string;
  suggestedMatch: Record<string, unknown> | null;
}

function formatCurrency(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1000000) return `${(abs / 1000000).toFixed(1)} million dollars`;
  if (abs >= 1000) return `${Math.round(abs / 1000)} thousand dollars`;
  return `${abs} dollars`;
}

function generatePrompt(item: {
  id: string;
  type: string;
  sourceEntity: string;
  suggestedMatch: Record<string, unknown> | null;
  confidence: number;
  context: Record<string, unknown> | null;
}): VoicePrompt {
  const match = item.suggestedMatch;

  switch (item.type) {
    case "customer_match": {
      const amount = item.context?.amount
        ? formatCurrency(item.context.amount as number)
        : "a payment";
      const date = item.context?.postedAt
        ? `on ${new Date(item.context.postedAt as string).toLocaleDateString("en-US", { month: "long", day: "numeric" })}`
        : "";

      if (match) {
        return {
          itemId: item.id,
          type: item.type,
          prompt: `We received ${amount} from "${item.sourceEntity}" ${date}. Should I file this under ${match.label}?`,
          suggestedMatch: match,
        };
      }
      return {
        itemId: item.id,
        type: item.type,
        prompt: `We received ${amount} from "${item.sourceEntity}" ${date}. I don't recognize this name. Which customer is this?`,
        suggestedMatch: null,
      };
    }

    default:
      return {
        itemId: item.id,
        type: item.type,
        prompt: `I have an unresolved item: "${item.sourceEntity}". What should I do with it?`,
        suggestedMatch: match,
      };
  }
}

/** Generate a voice session with all pending items as prompts */
export async function generateVoiceSession(db: PrismaClient, limit = 10) {
  const items = await getPendingItems(db, { limit });

  const summary =
    items.length === 0
      ? "All caught up. No items to review."
      : items.length === 1
        ? "You have one item to review."
        : `You have ${items.length} items to review.`;

  const prompts = items.map((item) =>
    generatePrompt(item as Parameters<typeof generatePrompt>[0])
  );

  return { summary, prompts, totalPending: items.length };
}

// ── Response parsing ───────────────────────────────────

interface ParsedIntent {
  action: "approve" | "reject" | "skip" | "manual";
  customerId?: string;
  customerName?: string; // extracted name for manual resolution
}

/** Parse a voice transcript into a resolution intent (rule-based, no LLM needed for common cases) */
export function parseVoiceResponse(
  transcript: string,
  _item: { type: string; suggestedMatch: Record<string, unknown> | null }
): ParsedIntent {
  const text = transcript.toLowerCase().trim();

  // Affirmative responses
  const affirmative = ["yes", "yeah", "yep", "correct", "right", "sure", "that's right", "approve", "confirm"];
  if (affirmative.some((a) => text.startsWith(a) || text === a)) {
    return { action: "approve" };
  }

  // Skip responses
  const skipWords = ["skip", "next", "pass", "later"];
  if (skipWords.some((s) => text.startsWith(s) || text === s)) {
    return { action: "skip" };
  }

  // Negative responses
  const negative = ["no", "nope", "wrong", "not", "reject"];
  if (negative.some((n) => text.startsWith(n))) {
    // Check for "no, it's [name]" pattern
    const nameMatch = text.match(/(?:no|nope|not),?\s*(?:it's|its|that's|thats|it is)\s+(.+)/);
    if (nameMatch) {
      return { action: "manual", customerName: nameMatch[1].trim() };
    }
    return { action: "reject" };
  }

  // Default: if we can't parse, skip for later review (safe default)
  return { action: "skip" };
}

/** Process a voice response and resolve the item */
export async function processVoiceResponse(
  db: PrismaClient,
  itemId: string,
  transcript: string
) {
  const item = await db.resolutionItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error("Resolution item not found");

  const suggestedMatch = item.suggestedMatch ? JSON.parse(item.suggestedMatch) : null;
  const intent = parseVoiceResponse(transcript, { type: item.type, suggestedMatch });

  if (intent.action === "skip") {
    return { resolved: false, action: "skip" };
  }

  const decision: ResolveDecision = {
    action: intent.action,
    customerId: intent.customerId ?? suggestedMatch?.id ?? suggestedMatch?.customerId,
  };

  // For approve, pull IDs from suggested match
  if (intent.action === "approve" && suggestedMatch) {
    decision.customerId = decision.customerId ?? suggestedMatch.id ?? suggestedMatch.customerId;
  }

  const result = await resolveItem(db, itemId, decision, "voice" as ResolutionChannel);

  return {
    resolved: true,
    action: intent.action,
    ...(intent.customerName ? { extractedName: intent.customerName } : {}),
    ...result,
  };
}
