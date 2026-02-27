import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/** Token overlap score: how many words from A appear in B */
function tokenOverlap(a: string, b: string): number {
  const tokensA = new Set(a.toLowerCase().split(/[\s,.\-_]+/).filter(Boolean));
  const tokensB = new Set(b.toLowerCase().split(/[\s,.\-_]+/).filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let overlap = 0;
  for (const t of tokensA) {
    for (const tb of tokensB) {
      if (t === tb || tb.includes(t) || t.includes(tb)) {
        overlap++;
        break;
      }
    }
  }
  return Math.round((overlap / Math.max(tokensA.size, tokensB.size)) * 100);
}

/**
 * GET /api/settings/team/suggest-counterparties
 *
 * Returns suggested mercuryCounterparty values for each team member
 * by matching team member names against distinct outgoing bank transaction
 * counterparty names.
 */
export async function GET() {
  const [teamMembers, counterparties] = await Promise.all([
    db.teamMember.findMany({
      where: { isActive: true },
      select: { id: true, name: true, mercuryCounterparty: true },
    }),
    db.bankTransaction.groupBy({
      by: ["counterpartyName"],
      where: {
        direction: "outgoing",
        counterpartyName: { not: null },
      },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const counterpartySummary = new Map<string, { name: string; totalAmount: number; txCount: number }>();
  for (const row of counterparties) {
    if (!row.counterpartyName) continue;
    counterpartySummary.set(row.counterpartyName, {
      name: row.counterpartyName,
      totalAmount: Math.abs(row._sum.amount ?? 0),
      txCount: row._count,
    });
  }

  // For each team member, find the best matching counterparty
  const suggestions: Array<{
    teamMemberId: string;
    teamMemberName: string;
    currentCounterparty: string | null;
    suggestedCounterparty: string | null;
    confidence: number;
    totalPaid: number;
    txCount: number;
  }> = [];

  for (const member of teamMembers) {
    const memberNameLower = member.name.toLowerCase().trim();
    const memberTokens = memberNameLower.split(/\s+/);

    let bestMatch: string | null = null;
    let bestScore = 0;
    let bestSummary = { totalAmount: 0, txCount: 0 };

    for (const [cpName, summary] of counterpartySummary) {
      const cpLower = cpName.toLowerCase().trim();

      // Exact match
      if (cpLower === memberNameLower) {
        bestMatch = cpName;
        bestScore = 100;
        bestSummary = summary;
        break;
      }

      // Check if all member name tokens appear in counterparty (or vice versa)
      const allTokensMatch = memberTokens.every(
        (t) => cpLower.includes(t)
      );
      if (allTokensMatch && memberTokens.length >= 2) {
        const score = 90;
        if (score > bestScore) {
          bestMatch = cpName;
          bestScore = score;
          bestSummary = summary;
        }
        continue;
      }

      // Token overlap
      const overlap = tokenOverlap(memberNameLower, cpLower);
      if (overlap > bestScore && overlap >= 50) {
        bestMatch = cpName;
        bestScore = overlap;
        bestSummary = summary;
      }
    }

    suggestions.push({
      teamMemberId: member.id,
      teamMemberName: member.name,
      currentCounterparty: member.mercuryCounterparty,
      suggestedCounterparty: bestMatch,
      confidence: bestScore,
      totalPaid: bestSummary.totalAmount,
      txCount: bestSummary.txCount,
    });
  }

  return NextResponse.json({
    suggestions,
    allCounterparties: Array.from(counterpartySummary.values()).sort(
      (a, b) => b.totalAmount - a.totalAmount
    ),
  });
}
