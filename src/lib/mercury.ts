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

  let synced = 0;
  let reconciled = 0;

  for (const account of accounts) {
    // Get last 90 days of transactions
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    const transactions = await getTransactions(
      account.id,
      startDate.toISOString().split("T")[0]
    );

    for (const txn of transactions) {
      // Only process incoming (positive) transactions for revenue
      if (txn.amount <= 0) continue;

      // Try to match counterparty to a customer
      let matchedCustomerId: string | null = null;
      const counterparty = txn.counterpartyName?.toLowerCase() ?? "";

      for (const customer of customers) {
        const bankName = customer.bankName?.toLowerCase();
        if (bankName && counterparty.includes(bankName)) {
          matchedCustomerId = customer.id;
          break;
        }
        // Check aliases
        for (const alias of customer.aliases) {
          if (counterparty.includes(alias.toLowerCase())) {
            matchedCustomerId = customer.id;
            break;
          }
        }
        if (matchedCustomerId) break;
      }

      // Determine the reconciled month from postedAt
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
          description: txn.note || txn.kind,
          counterpartyName: txn.counterpartyName,
          status: txn.status,
          postedAt: txn.postedAt ? new Date(txn.postedAt) : null,
          customerId: matchedCustomerId,
          isReconciled: !!matchedCustomerId,
          reconciledMonth,
        },
        update: {
          status: txn.status,
          postedAt: txn.postedAt ? new Date(txn.postedAt) : null,
          // Only update reconciliation if not already manually reconciled
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
    }
  }

  return { synced, reconciled };
}
