import { fetchWithRetry } from "./fetch-with-retry";
import type { Logger } from "./logger";

const MERCURY_BASE_URL = "https://api.mercury.com/api/v1";

function getHeaders() {
  return {
    Authorization: `Bearer ${process.env.MERCURY_API_KEY}`,
    "Content-Type": "application/json",
  };
}

interface MercuryAccount {
  id: string;
  name: string;
  kind: string;
  status: string;
  currentBalance: number;
}

interface MercuryTransaction {
  id: string;
  amount: number;
  status: string;
  note: string;
  counterpartyName: string;
  counterpartyId: string;
  kind: string;
  postedAt: string | null;
  createdAt: string;
  currencyExponent: number;
  dashboardLink: string;
}

export async function getAccounts(logger?: Logger): Promise<MercuryAccount[]> {
  const res = await fetchWithRetry(`${MERCURY_BASE_URL}/accounts`, {
    headers: getHeaders(),
  }, { logger });
  if (!res.ok) throw new Error(`Mercury API error: ${res.status}`);
  const data = await res.json();
  return data.accounts;
}

export async function getTransactions(
  accountId: string,
  startDate?: string,
  endDate?: string,
  logger?: Logger
): Promise<MercuryTransaction[]> {
  const params = new URLSearchParams();
  if (startDate) params.set("start", startDate);
  if (endDate) params.set("end", endDate);
  params.set("limit", "500");

  const url = `${MERCURY_BASE_URL}/account/${accountId}/transactions?${params}`;
  const res = await fetchWithRetry(url, { headers: getHeaders() }, { logger });
  if (!res.ok) throw new Error(`Mercury API error: ${res.status}`);
  const data = await res.json();
  return data.transactions ?? [];
}

export async function testConnection(): Promise<boolean> {
  try {
    const accounts = await getAccounts();
    return accounts.length > 0;
  } catch {
    return false;
  }
}

/** Known software vendors — matched by substring against counterpartyName */
const KNOWN_SOFTWARE = [
  "github", "linear", "vercel", "openai", "anthropic", "neon",
  "supabase", "figma", "notion", "slack", "aws", "stripe",
  "render", "heroku", "netlify", "sentry", "datadog", "google",
  "microsoft", "apple", "zoom", "cloudflare", "digitalocean",
];

/** Platforms that bundle multiple engineer payments (need manual splitting) */
const MULTI_ENGINEER_PLATFORMS = ["upwork", "deel", "remote.com", "gusto"];

export async function syncTransactions(db: import("@prisma/client").PrismaClient, logger?: Logger) {
  const startTime = Date.now();
  logger?.info("Mercury sync started");
  const accounts = await getAccounts(logger);
  logger?.info("Mercury accounts fetched", { count: accounts.length });
  const customers = await db.customer.findMany();
  const teamMembers = await db.teamMember.findMany({
    where: { isActive: true, mercuryCounterparty: { not: null } },
  });

  // Build counterparty -> teamMember map for outgoing matching
  const counterpartyToMember = new Map<string, { id: string; name: string }>();
  for (const member of teamMembers) {
    if (member.mercuryCounterparty) {
      counterpartyToMember.set(member.mercuryCounterparty.toLowerCase(), {
        id: member.id,
        name: member.name,
      });
    }
  }

  let synced = 0;
  let reconciled = 0;
  const engineerPaymentsToCreate: Array<{ bankTransactionMercuryId: string; teamMemberId: string; amount: number; postedAt: string }> = [];

  for (const account of accounts) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    const transactions = await getTransactions(
      account.id,
      startDate.toISOString().split("T")[0],
      undefined,
      logger
    );

    // Pre-fetch existing reconciliation status for all transactions in this batch
    const txnIds = transactions.map((t) => t.id);
    const existingTxns = await db.bankTransaction.findMany({
      where: { mercuryId: { in: txnIds } },
      select: { mercuryId: true, isReconciled: true },
    });
    const reconciledMap = new Map(existingTxns.map((t) => [t.mercuryId, t.isReconciled]));

    // Prepare upsert operations, then batch in groups of 50
    const BATCH_SIZE = 50;
    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
      const batch = transactions.slice(i, i + BATCH_SIZE);

      await db.$transaction(
        batch.map((txn) => {
          const direction = txn.amount > 0 ? "incoming" : "outgoing";

          if (direction === "incoming") {
            const counterparty = txn.counterpartyName?.toLowerCase() ?? "";
            const STRIPE_NAMES = ["stripe", "stripe payments", "stripe technology"];
            const isStripePayout = STRIPE_NAMES.some((s) => counterparty.includes(s));

            let matchedCustomerId: string | null = null;
            for (const customer of customers) {
              const bankName = customer.bankName?.toLowerCase();
              if (bankName && counterparty.includes(bankName)) {
                matchedCustomerId = customer.id;
                break;
              }
              for (const alias of customer.aliases) {
                if (counterparty.includes(alias.toLowerCase())) {
                  matchedCustomerId = customer.id;
                  break;
                }
              }
              if (matchedCustomerId) break;
            }

            let reconciledMonth: string | null = null;
            if (matchedCustomerId && txn.postedAt) {
              const posted = new Date(txn.postedAt);
              reconciledMonth = `${posted.getFullYear()}-${String(posted.getMonth() + 1).padStart(2, "0")}`;
            }

            const alreadyReconciled = reconciledMap.get(txn.id) === true;
            if (matchedCustomerId) reconciled++;

            return db.bankTransaction.upsert({
              where: { mercuryId: txn.id },
              create: {
                mercuryId: txn.id,
                amount: txn.amount,
                currency: "USD",
                description: isStripePayout
                  ? `[Stripe Payout] ${txn.note || txn.kind}`
                  : txn.note || txn.kind,
                counterpartyName: txn.counterpartyName,
                status: txn.status,
                postedAt: txn.postedAt ? new Date(txn.postedAt) : null,
                customerId: matchedCustomerId,
                isReconciled: !!matchedCustomerId,
                reconciledMonth,
                direction: "incoming",
              },
              update: {
                status: txn.status,
                postedAt: txn.postedAt ? new Date(txn.postedAt) : null,
                ...(!alreadyReconciled && matchedCustomerId
                  ? { customerId: matchedCustomerId, isReconciled: true, reconciledMonth }
                  : {}),
              },
            });
          } else {
            // Outgoing: classify as engineer, software, or overhead
            const counterparty = txn.counterpartyName?.toLowerCase() ?? "";
            let costCategory: string;

            const matchedMember = counterpartyToMember.get(counterparty);
            if (matchedMember) {
              costCategory = "engineer";
              // Track for EngineerPayment creation after upsert
              if (txn.postedAt) {
                engineerPaymentsToCreate.push({
                  bankTransactionMercuryId: txn.id,
                  teamMemberId: matchedMember.id,
                  amount: Math.abs(txn.amount),
                  postedAt: txn.postedAt,
                });
              }
            } else if (KNOWN_SOFTWARE.some((s) => counterparty.includes(s))) {
              costCategory = "software";
            } else {
              costCategory = "overhead";
            }

            return db.bankTransaction.upsert({
              where: { mercuryId: txn.id },
              create: {
                mercuryId: txn.id,
                amount: txn.amount,
                currency: "USD",
                description: txn.note || txn.kind,
                counterpartyName: txn.counterpartyName,
                status: txn.status,
                postedAt: txn.postedAt ? new Date(txn.postedAt) : null,
                direction: "outgoing",
                costCategory,
              },
              update: {
                status: txn.status,
                postedAt: txn.postedAt ? new Date(txn.postedAt) : null,
                costCategory,
              },
            });
          }
        })
      );

      synced += batch.length;
    }
  }

  // Create EngineerPayment records for direct engineer matches
  let engineerPaymentsCreated = 0;
  for (const ep of engineerPaymentsToCreate) {
    const txn = await db.bankTransaction.findUnique({
      where: { mercuryId: ep.bankTransactionMercuryId },
      select: { id: true },
    });
    if (!txn) continue;

    const posted = new Date(ep.postedAt);
    const month = `${posted.getFullYear()}-${String(posted.getMonth() + 1).padStart(2, "0")}`;

    try {
      await db.engineerPayment.upsert({
        where: {
          bankTransactionId_teamMemberId: {
            bankTransactionId: txn.id,
            teamMemberId: ep.teamMemberId,
          },
        },
        create: {
          teamMemberId: ep.teamMemberId,
          bankTransactionId: txn.id,
          amount: ep.amount,
          month,
        },
        update: {
          amount: ep.amount,
          month,
        },
      });
      engineerPaymentsCreated++;
    } catch {
      // Skip if already exists or constraint error
    }
  }

  // Create resolution items for unmatched incoming transactions only
  const { matchCustomer } = await import("./matching");
  const { createResolutionItems } = await import("./resolution-queue");

  const unmatchedIncoming = await db.bankTransaction.findMany({
    where: { direction: "incoming", isReconciled: false, counterpartyName: { not: null } },
    select: { counterpartyName: true, amount: true, postedAt: true },
    distinct: ["counterpartyName"],
  });

  const resolutionItems = [];

  for (const txn of unmatchedIncoming) {
    if (!txn.counterpartyName) continue;
    const matches = matchCustomer(txn.counterpartyName, customers);
    const best = matches[0];
    resolutionItems.push({
      type: "customer_match" as const,
      sourceEntity: txn.counterpartyName,
      suggestedMatch: best ? { id: best.id, label: best.label, confidence: best.confidence, matchedOn: best.matchedOn } : undefined,
      confidence: best?.confidence ?? 0,
      context: { amount: txn.amount, postedAt: txn.postedAt?.toISOString() },
    });
  }

  const resolutionResult = await createResolutionItems(db, resolutionItems);

  logger?.info("Mercury sync completed", {
    synced,
    reconciled,
    engineerPaymentsCreated,
    resolution: resolutionResult,
    durationMs: Date.now() - startTime,
  });

  return { synced, reconciled, engineerPaymentsCreated, resolution: resolutionResult };
}

/**
 * Queue engineer_split resolution items for multi-engineer platform payments
 * (e.g., Upwork, Deel) that need manual splitting across engineers.
 * Direct engineer matches are handled in syncTransactions.
 */
export async function matchLaborTransactionsToEngineers(
  db: import("@prisma/client").PrismaClient,
  logger?: Logger
) {
  // Find engineer-tagged transactions without EngineerPayment records
  // These are platform payments that weren't directly matched to a team member
  const unmatchedEngineerTxns = await db.bankTransaction.findMany({
    where: {
      direction: "outgoing",
      costCategory: "engineer",
      engineerPayments: { none: {} },
      postedAt: { not: null },
    },
  });

  // Also check for multi-engineer platform payments tagged as overhead
  // that should actually be engineer splits
  const platformTxns = await db.bankTransaction.findMany({
    where: {
      direction: "outgoing",
      costCategory: "overhead",
      engineerPayments: { none: {} },
      postedAt: { not: null },
      counterpartyName: { not: null },
    },
  });

  const platformPayments = platformTxns.filter((txn) => {
    const cp = txn.counterpartyName?.toLowerCase() ?? "";
    return MULTI_ENGINEER_PLATFORMS.some((p) => cp.includes(p));
  });

  // Reclassify platform payments as engineer
  for (const txn of platformPayments) {
    await db.bankTransaction.update({
      where: { id: txn.id },
      data: { costCategory: "engineer" },
    });
  }

  const allUnmatched = [...unmatchedEngineerTxns, ...platformPayments];
  let queued = 0;

  // Group by counterparty name
  const byCounterparty = new Map<string, typeof allUnmatched>();
  for (const txn of allUnmatched) {
    if (!txn.counterpartyName) continue;
    const existing = byCounterparty.get(txn.counterpartyName) ?? [];
    existing.push(txn);
    byCounterparty.set(txn.counterpartyName, existing);
  }

  if (byCounterparty.size > 0) {
    const { createResolutionItems } = await import("./resolution-queue");
    const allMembers = await db.teamMember.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    const resolutionItems = [];
    for (const [counterparty, txns] of byCounterparty) {
      const transactionIds = txns.map((t) => t.id);
      const totalAmount = txns.reduce((sum, t) => sum + Math.abs(t.amount), 0);

      resolutionItems.push({
        type: "engineer_split" as const,
        sourceEntity: counterparty,
        suggestedMatch: undefined,
        confidence: 0,
        context: {
          totalAmount,
          transactionCount: txns.length,
          transactionIds,
          teamMembers: allMembers.map((m) => ({ id: m.id, name: m.name })),
        },
      });
    }

    const result = await createResolutionItems(db, resolutionItems);
    queued = result.created;
  }

  logger?.info("Engineer split matching completed", { queued });
  return { queued };
}

export async function recalculateMonthlyCosts(db: import("@prisma/client").PrismaClient) {
  const outgoing = await db.bankTransaction.findMany({
    where: { direction: "outgoing" },
    select: { amount: true, postedAt: true, costCategory: true },
  });

  const monthMap = new Map<string, { engineer: number; software: number; overhead: number }>();

  for (const txn of outgoing) {
    if (!txn.postedAt) continue;
    const posted = new Date(txn.postedAt);
    const month = `${posted.getFullYear()}-${String(posted.getMonth() + 1).padStart(2, "0")}`;
    const entry = monthMap.get(month) ?? { engineer: 0, software: 0, overhead: 0 };
    const absAmount = Math.abs(txn.amount);

    switch (txn.costCategory) {
      case "engineer":
      case "labor": // backwards compat for unmigrated data
        entry.engineer += absAmount;
        break;
      case "software":
        entry.software += absAmount;
        break;
      default:
        entry.overhead += absAmount;
        break;
    }
    monthMap.set(month, entry);
  }

  for (const [month, costs] of monthMap) {
    await db.monthlyCostSummary.upsert({
      where: { month },
      create: {
        month,
        laborCost: costs.engineer,
        softwareCost: costs.software,
        otherCost: costs.overhead,
        totalCost: costs.engineer + costs.software + costs.overhead,
      },
      update: {
        laborCost: costs.engineer,
        softwareCost: costs.software,
        otherCost: costs.overhead,
        totalCost: costs.engineer + costs.software + costs.overhead,
        calculatedAt: new Date(),
      },
    });
  }
}
