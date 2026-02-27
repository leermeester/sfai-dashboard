import { getPendingItems, resolveItem, getStats, type ResolutionChannel, type ResolveDecision } from "./resolution-queue";
import type { PrismaClient } from "@prisma/client";

const SLACK_API = "https://slack.com/api";

function getToken() {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN not set");
  return token;
}

function getChannelId() {
  const id = process.env.SLACK_CHANNEL_ID;
  if (!id) throw new Error("SLACK_CHANNEL_ID not set");
  return id;
}

// ── Slack API helpers ──────────────────────────────────

async function slackPost(method: string, body: Record<string, unknown>) {
  const res = await fetch(`${SLACK_API}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ── Block Kit message builders ─────────────────────────

const typeEmoji: Record<string, string> = {
  customer_match: "💰",
  engineer_split: "👥",
};

const typeLabel: Record<string, string> = {
  customer_match: "Unmatched Income",
  engineer_split: "Engineer Split",
};

const typeThink: Record<string, string> = {
  customer_match: "Does this company name match your customer?",
  engineer_split: "How should this payment be split across engineers?",
};

interface SlackItem {
  id: string;
  type: string;
  sourceEntity: string;
  suggestedMatch: {
    label?: string;
    confidence?: number;
    meetingType?: string;
    category?: string;
    id?: string;
    customerId?: string;
  } | null;
  confidence: number;
  context: Record<string, unknown> | null;
}

function buildItemBlocks(item: SlackItem) {
  const emoji = typeEmoji[item.type] || "❓";
  const label = typeLabel[item.type] || item.type;
  const think = typeThink[item.type] || "What should we do with this?";

  const contextParts: string[] = [];
  if (item.context?.amount) {
    contextParts.push(`$${Math.abs(item.context.amount as number).toLocaleString()}`);
  }
  if (item.context?.meetingCount) {
    contextParts.push(`${item.context.meetingCount} meetings`);
  }
  if (item.context?.postedAt) {
    contextParts.push(new Date(item.context.postedAt as string).toLocaleDateString());
  }

  const blocks: Record<string, unknown>[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${emoji} *${label}*\n"${item.sourceEntity}"${contextParts.length ? ` — ${contextParts.join(" · ")}` : ""}`,
      },
    },
  ];

  if (item.suggestedMatch) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Suggested: *${item.suggestedMatch.label}* (${item.confidence}% match)\n_Think: ${think}_`,
      },
    });
  }

  // Action buttons depend on type
  const actions: Record<string, unknown>[] = [];

  if (item.type === "customer_match") {
    if (item.suggestedMatch) {
      actions.push({
        type: "button",
        text: { type: "plain_text", text: `✓ Yes, it's ${item.suggestedMatch.label}` },
        style: "primary",
        action_id: "approve",
        value: JSON.stringify({ itemId: item.id, action: "approve", customerId: item.suggestedMatch.id }),
      });
    }
    actions.push({
      type: "button",
      text: { type: "plain_text", text: "✗ Different customer" },
      action_id: "reject",
      value: JSON.stringify({ itemId: item.id, action: "reject" }),
    });
    actions.push({
      type: "button",
      text: { type: "plain_text", text: "⏭ Skip" },
      action_id: "skip",
      value: JSON.stringify({ itemId: item.id, action: "skip" }),
    });
  }

  if (actions.length > 0) {
    blocks.push({ type: "actions", elements: actions });
  }

  blocks.push({ type: "divider" });

  return blocks;
}

// ── Public functions ───────────────────────────────────

/** Send daily digest of pending resolution items */
export async function sendDailyDigest(db: PrismaClient) {
  const stats = await getStats(db);
  if (stats.pending === 0) return { sent: false, reason: "no pending items" };

  const items = await getPendingItems(db, { limit: 10 });

  const headerBlock = {
    type: "section",
    text: {
      type: "mrkdwn",
      text: `🔔 *SFAI Data Review* — ${stats.pending} item${stats.pending === 1 ? "" : "s"} need${stats.pending === 1 ? "s" : ""} attention`,
    },
  };

  const blocks: Record<string, unknown>[] = [headerBlock, { type: "divider" }];

  for (const item of items) {
    blocks.push(...buildItemBlocks(item as unknown as SlackItem));
  }

  if (stats.pending > 10) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `_${stats.pending - 10} more items in the dashboard →_`,
        },
      ],
    });
  }

  await slackPost("chat.postMessage", {
    channel: getChannelId(),
    text: `SFAI Data Review — ${stats.pending} items need attention`,
    blocks,
  });

  return { sent: true, itemCount: items.length, totalPending: stats.pending };
}

/** Handle Slack interactive payload (button click) */
export async function handleInteraction(
  db: PrismaClient,
  payload: {
    actions: { action_id: string; value: string }[];
    response_url: string;
  }
) {
  const action = payload.actions[0];
  if (!action) return;

  const data = JSON.parse(action.value);
  const { itemId, ...rest } = data;

  if (rest.action === "skip") {
    // Update message to show skipped
    await fetch(payload.response_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        replace_original: false,
        text: `⏭ Skipped`,
      }),
    });
    return { skipped: true };
  }

  const decision: ResolveDecision = {
    action: rest.action,
    customerId: rest.customerId,
  };

  const result = await resolveItem(db, itemId, decision, "slack" as ResolutionChannel);

  // Update message to show resolved
  await fetch(payload.response_url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      replace_original: false,
      text: `✅ Resolved via Slack`,
    }),
  });

  return result;
}

/** Send error alert to Slack channel */
export async function sendErrorAlert(
  error: Error,
  context: { sync: string; correlationId?: string }
) {
  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:rotating_light: *Sync Failure: ${context.sync}*`,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Error:*\n\`${error.message}\`` },
        { type: "mrkdwn", text: `*Time:*\n${new Date().toISOString()}` },
        ...(context.correlationId
          ? [{ type: "mrkdwn", text: `*Correlation ID:*\n\`${context.correlationId}\`` }]
          : []),
      ],
    },
  ];

  await slackPost("chat.postMessage", {
    channel: getChannelId(),
    text: `Sync failure: ${context.sync} — ${error.message}`,
    blocks,
  });
}

/** Verify Slack request signature */
export function verifySlackSignature(
  signingSecret: string,
  timestamp: string,
  body: string,
  signature: string
): boolean {
  const crypto = require("crypto") as typeof import("crypto");
  const sigBasestring = `v0:${timestamp}:${body}`;
  const hmac = crypto.createHmac("sha256", signingSecret).update(sigBasestring).digest("hex");
  const mySignature = `v0=${hmac}`;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(mySignature, "utf8"),
      Buffer.from(signature, "utf8")
    );
  } catch {
    return false;
  }
}
