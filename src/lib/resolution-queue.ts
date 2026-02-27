import type { PrismaClient, Prisma } from "@prisma/client";
import { AUTO_RESOLVE_THRESHOLD, AUTO_RESOLVE_THRESHOLDS } from "./matching";
import { generateProposals } from "./proposal-engine";

// ── Types ──────────────────────────────────────────────

export type ResolutionType =
  | "customer_match"
  | "engineer_split";

export type ResolutionStatus = "pending" | "auto_resolved" | "confirmed" | "rejected";
export type ResolutionChannel = "dashboard" | "voice" | "cli" | "slack";

export interface ResolutionItemInput {
  type: ResolutionType;
  sourceEntity: string;
  suggestedMatch?: {
    id?: string;
    label: string;
    confidence: number;
    matchedOn?: string;
  };
  confidence: number;
  context?: Record<string, unknown>;
}

export interface ResolveDecision {
  action: "approve" | "reject" | "skip" | "manual";
  customerId?: string;
  bankName?: string;
  engineerSplits?: Array<{ teamMemberId: string; amount: number }>;
}

type TxClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

// ── Validation ────────────────────────────────────────

async function validateDecision(
  tx: TxClient,
  type: ResolutionType,
  decision: ResolveDecision
) {
  switch (type) {
    case "customer_match": {
      if (decision.customerId) {
        const customer = await tx.customer.findUnique({ where: { id: decision.customerId } });
        if (!customer) {
          throw new Error(`Customer not found: ${decision.customerId}`);
        }
      }
      break;
    }
  }
}

// ── Audit logging ─────────────────────────────────────

interface AuditEntry {
  resolutionItemId: string;
  entityType: string;
  entityId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

async function writeAuditLogs(tx: TxClient, entries: AuditEntry[]) {
  if (entries.length === 0) return;
  for (const entry of entries) {
    await (tx as unknown as PrismaClient).resolutionAuditLog.create({ data: entry });
  }
}

// ── Queue operations ───────────────────────────────────

/** Bulk-create resolution items, skipping duplicates and auto-resolving high-confidence matches */
export async function createResolutionItems(
  db: PrismaClient,
  items: ResolutionItemInput[]
): Promise<{ created: number; autoResolved: number; skipped: number }> {
  let created = 0;
  let autoResolved = 0;
  let skipped = 0;

  for (const item of items) {
    const threshold = AUTO_RESOLVE_THRESHOLDS[item.type] ?? AUTO_RESOLVE_THRESHOLD;
    const shouldAutoResolve = item.confidence >= threshold;

    try {
      const upserted = await db.resolutionItem.upsert({
        where: {
          type_sourceEntity: {
            type: item.type,
            sourceEntity: item.sourceEntity,
          },
        },
        create: {
          type: item.type,
          sourceEntity: item.sourceEntity,
          suggestedMatch: item.suggestedMatch ? JSON.stringify(item.suggestedMatch) : null,
          confidence: item.confidence,
          context: item.context ? JSON.stringify(item.context) : null,
          status: shouldAutoResolve ? "auto_resolved" : "pending",
          resolvedAt: shouldAutoResolve ? new Date() : null,
          resolvedVia: shouldAutoResolve ? "system" : null,
        },
        update: {
          suggestedMatch: item.suggestedMatch ? JSON.stringify(item.suggestedMatch) : undefined,
          confidence: item.confidence,
          context: item.context ? JSON.stringify(item.context) : undefined,
        },
      });

      if (shouldAutoResolve && item.suggestedMatch) {
        // Auto-resolution in a transaction
        await db.$transaction(async (tx) => {
          await applyResolution(tx, item.type, item.sourceEntity, {
            action: "approve",
            customerId: item.suggestedMatch!.id,
          }, upserted.id);
        }, { timeout: 10000 });
        autoResolved++;
      } else {
        created++;
      }
    } catch {
      skipped++;
    }
  }

  return { created, autoResolved, skipped };
}

/** Fetch pending items with optional filters */
export async function getPendingItems(
  db: PrismaClient,
  options: {
    type?: ResolutionType;
    status?: ResolutionStatus;
    limit?: number;
    offset?: number;
  } = {}
) {
  const { type, status = "pending", limit = 50, offset = 0 } = options;

  const items = await db.resolutionItem.findMany({
    where: {
      status,
      ...(type ? { type } : {}),
    },
    orderBy: [
      { confidence: "desc" },
      { createdAt: "desc" },
    ],
    take: limit,
    skip: offset,
  });

  return items.map((item) => ({
    ...item,
    suggestedMatch: item.suggestedMatch ? JSON.parse(item.suggestedMatch) : null,
    context: item.context ? JSON.parse(item.context) : null,
  }));
}

/** Resolve a single item and apply side effects in a single transaction */
export async function resolveItem(
  db: PrismaClient,
  itemId: string,
  decision: ResolveDecision,
  channel: ResolutionChannel
) {
  const item = await db.resolutionItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error("Resolution item not found");
  if (item.status === "confirmed" || item.status === "rejected") {
    throw new Error(`Item already resolved as ${item.status}`);
  }

  if (decision.action === "skip") {
    return { skipped: true };
  }

  const newStatus = decision.action === "approve" || decision.action === "manual" ? "confirmed" : "rejected";

  // Wrap status update + side effects in a single transaction
  await db.$transaction(async (tx) => {
    await tx.resolutionItem.update({
      where: { id: itemId },
      data: {
        status: newStatus,
        resolvedVia: channel,
        resolvedAt: new Date(),
      },
    });

    if (decision.action === "approve" || decision.action === "manual") {
      await applyResolution(
        tx,
        item.type as ResolutionType,
        item.sourceEntity,
        decision,
        itemId
      );
    }
  }, { timeout: 10000 });

  // Generate proposals asynchronously (non-blocking, best-effort)
  generateProposals(
    db,
    item.type as ResolutionType,
    item.sourceEntity,
    decision,
    itemId
  ).catch(() => {
    // Proposal generation is non-critical — log but don't fail the resolution
  });

  return { resolved: true, status: newStatus };
}

/** Get summary counts for badges */
export async function getStats(db: PrismaClient) {
  const [pending, autoResolved, confirmed, rejected] = await Promise.all([
    db.resolutionItem.count({ where: { status: "pending" } }),
    db.resolutionItem.count({ where: { status: "auto_resolved" } }),
    db.resolutionItem.count({ where: { status: "confirmed" } }),
    db.resolutionItem.count({ where: { status: "rejected" } }),
  ]);

  const byType = await db.resolutionItem.groupBy({
    by: ["type"],
    where: { status: "pending" },
    _count: true,
  });

  const typeBreakdown: Record<string, number> = {};
  for (const row of byType) {
    typeBreakdown[row.type] = row._count;
  }

  return { pending, autoResolved, confirmed, rejected, byType: typeBreakdown };
}

// ── Side effects: apply resolution to actual entities ──

async function applyResolution(
  tx: TxClient,
  type: ResolutionType,
  sourceEntity: string,
  decision: ResolveDecision,
  resolutionItemId: string
) {
  // Validate before applying
  await validateDecision(tx, type, decision);

  const auditEntries: AuditEntry[] = [];

  switch (type) {
    case "customer_match": {
      if (decision.customerId) {
        const txns = await tx.bankTransaction.findMany({
          where: {
            counterpartyName: { contains: sourceEntity, mode: "insensitive" as Prisma.QueryMode },
            isReconciled: false,
            direction: "incoming",
          },
        });

        for (const txn of txns) {
          let reconciledMonth: string | null = null;
          if (txn.postedAt) {
            const posted = new Date(txn.postedAt);
            reconciledMonth = `${posted.getFullYear()}-${String(posted.getMonth() + 1).padStart(2, "0")}`;
          }

          auditEntries.push({
            resolutionItemId,
            entityType: "BankTransaction",
            entityId: txn.id,
            field: "customerId",
            oldValue: txn.customerId ?? null,
            newValue: decision.customerId!,
          });

          await tx.bankTransaction.update({
            where: { id: txn.id },
            data: {
              customerId: decision.customerId,
              isReconciled: true,
              reconciledMonth,
            },
          });
        }

        // Save bankName alias
        if (decision.bankName || sourceEntity) {
          const customer = await tx.customer.findUnique({
            where: { id: decision.customerId },
          });
          if (customer) {
            const nameToSave = (decision.bankName || sourceEntity).toLowerCase();
            if (
              customer.bankName?.toLowerCase() !== nameToSave &&
              !customer.aliases.some((a) => a.toLowerCase() === nameToSave)
            ) {
              if (!customer.bankName) {
                auditEntries.push({
                  resolutionItemId,
                  entityType: "Customer",
                  entityId: customer.id,
                  field: "bankName",
                  oldValue: null,
                  newValue: nameToSave,
                });
                await tx.customer.update({
                  where: { id: customer.id },
                  data: { bankName: nameToSave },
                });
              } else {
                auditEntries.push({
                  resolutionItemId,
                  entityType: "Customer",
                  entityId: customer.id,
                  field: "aliases",
                  oldValue: JSON.stringify(customer.aliases),
                  newValue: JSON.stringify([...customer.aliases, nameToSave]),
                });
                await tx.customer.update({
                  where: { id: customer.id },
                  data: { aliases: [...customer.aliases, nameToSave] },
                });
              }
            }
          }
        }
      }
      break;
    }

    case "engineer_split": {
      if (decision.engineerSplits && decision.engineerSplits.length > 0) {
        // Parse context to get transactionIds
        const item = await tx.resolutionItem.findFirst({
          where: { type: "engineer_split", sourceEntity },
        });
        const context = item?.context ? JSON.parse(item.context as string) : {};
        const transactionIds: string[] = context.transactionIds ?? [];

        for (const txnId of transactionIds) {
          const txn = await tx.bankTransaction.findUnique({ where: { id: txnId } });
          if (!txn || !txn.postedAt) continue;

          const posted = new Date(txn.postedAt);
          const month = `${posted.getFullYear()}-${String(posted.getMonth() + 1).padStart(2, "0")}`;
          const txnAmount = Math.abs(txn.amount);

          // Distribute proportionally based on split amounts
          const splitTotal = decision.engineerSplits.reduce((s, e) => s + e.amount, 0);

          for (const split of decision.engineerSplits) {
            const amount = (split.amount / splitTotal) * txnAmount;

            await tx.engineerPayment.upsert({
              where: {
                bankTransactionId_teamMemberId: {
                  bankTransactionId: txnId,
                  teamMemberId: split.teamMemberId,
                },
              },
              create: {
                teamMemberId: split.teamMemberId,
                bankTransactionId: txnId,
                amount,
                month,
              },
              update: { amount, month },
            });

            auditEntries.push({
              resolutionItemId,
              entityType: "EngineerPayment",
              entityId: `${txnId}:${split.teamMemberId}`,
              field: "amount",
              oldValue: null,
              newValue: String(amount),
            });
          }
        }
      }
      break;
    }
  }

  // Write all audit logs within the same transaction
  await writeAuditLogs(tx, auditEntries);
}
