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

export async function getAccounts(): Promise<MercuryAccount[]> {
  const res = await fetch(`${MERCURY_BASE_URL}/accounts`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Mercury API error: ${res.status}`);
  const data = await res.json();
  return data.accounts;
}

export async function getTransactions(
  accountId: string,
  startDate?: string,
  endDate?: string
): Promise<MercuryTransaction[]> {
  const params = new URLSearchParams();
  if (startDate) params.set("start", startDate);
  if (endDate) params.set("end", endDate);
  params.set("limit", "500");

  const url = `${MERCURY_BASE_URL}/account/${accountId}/transactions?${params}`;
  const res = await fetch(url, { headers: getHeaders() });
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

export async function syncTransactions(db: import("@prisma/client").PrismaClient) {
  const accounts = await getAccounts();
  const customers = await db.customer.findMany();
  const vendorRules = await db.vendorCategoryRule.findMany();

  let synced = 0;
  let reconciled = 0;

  for (const account of accounts) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    const transactions = await getTransactions(
      account.id,
      startDate.toISOString().split("T")[0]
    );

    for (const txn of transactions) {
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

        await db.bankTransaction.upsert({
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
            ...(matchedCustomerId
              ? {
                  customerId: matchedCustomerId,
                  isReconciled: true,
                  reconciledMonth,
                }
              : {}),
          },
        });

        synced++;
        if (matchedCustomerId) reconciled++;
      } else {
        // Outgoing transaction: categorize by vendor rules
        const counterparty = txn.counterpartyName?.toLowerCase() ?? "";

        let costCategory: string | null = null;
        for (const rule of vendorRules) {
          if (counterparty.includes(rule.vendorPattern.toLowerCase())) {
            costCategory = rule.category;
            break;
          }
        }

        await db.bankTransaction.upsert({
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
            ...(costCategory ? { costCategory } : {}),
          },
        });

        synced++;
      }
    }
  }

  return { synced, reconciled };
}

export async function recalculateMonthlyCosts(db: import("@prisma/client").PrismaClient) {
  const outgoing = await db.bankTransaction.findMany({
    where: { direction: "outgoing" },
    select: { amount: true, postedAt: true, costCategory: true },
  });

  const monthMap = new Map<string, { labor: number; software: number; other: number }>();

  for (const txn of outgoing) {
    if (!txn.postedAt) continue;
    const posted = new Date(txn.postedAt);
    const month = `${posted.getFullYear()}-${String(posted.getMonth() + 1).padStart(2, "0")}`;
    const entry = monthMap.get(month) ?? { labor: 0, software: 0, other: 0 };
    const absAmount = Math.abs(txn.amount);

    switch (txn.costCategory) {
      case "labor":
        entry.labor += absAmount;
        break;
      case "software":
        entry.software += absAmount;
        break;
      default:
        entry.other += absAmount;
        break;
    }
    monthMap.set(month, entry);
  }

  for (const [month, costs] of monthMap) {
    await db.monthlyCostSummary.upsert({
      where: { month },
      create: {
        month,
        laborCost: costs.labor,
        softwareCost: costs.software,
        otherCost: costs.other,
        totalCost: costs.labor + costs.software + costs.other,
      },
      update: {
        laborCost: costs.labor,
        softwareCost: costs.software,
        otherCost: costs.other,
        totalCost: costs.labor + costs.software + costs.other,
        calculatedAt: new Date(),
      },
    });
  }
}
