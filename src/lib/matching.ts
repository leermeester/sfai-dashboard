/** Minimal customer shape needed by matching functions */
export interface MatchableCustomer {
  id: string;
  displayName: string;
  spreadsheetName?: string | null;
  bankName?: string | null;
  emailDomain?: string | null;
  aliases: string[];
}

// ── Types ──────────────────────────────────────────────

export interface MatchResult {
  id: string; // customerId
  label: string; // human-readable match name
  confidence: number; // 0-100
  matchedOn: string; // what field/strategy matched
}

// ── String distance utilities ──────────────────────────

/** Levenshtein edit distance */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** Normalize Levenshtein to 0-100 similarity score */
function levenshteinScore(a: string, b: string): number {
  if (!a || !b) return 0;
  const al = a.toLowerCase().trim();
  const bl = b.toLowerCase().trim();
  if (al === bl) return 100;
  const maxLen = Math.max(al.length, bl.length);
  if (maxLen === 0) return 100;
  return Math.round((1 - levenshtein(al, bl) / maxLen) * 100);
}

/** Token overlap: how many words from A appear in B (and vice versa) */
function tokenOverlap(a: string, b: string): number {
  if (!a || !b) return 0;
  const tokensA = new Set(a.toLowerCase().split(/[\s,.\-_]+/).filter(Boolean));
  const tokensB = new Set(b.toLowerCase().split(/[\s,.\-_]+/).filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let overlap = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) overlap++;
  }
  return Math.round((overlap / Math.max(tokensA.size, tokensB.size)) * 100);
}

/** Substring containment check — returns 0-100 */
function substringScore(needle: string, haystack: string): number {
  if (!needle || !haystack) return 0;
  const n = needle.toLowerCase().trim();
  const h = haystack.toLowerCase().trim();
  if (h.includes(n)) return 85;
  if (n.includes(h)) return 80;
  return 0;
}

/** Combined confidence: weighted blend of strategies */
function combinedConfidence(lev: number, token: number, sub: number): number {
  if (sub > 0) return Math.max(sub, Math.round(lev * 0.3 + token * 0.3 + sub * 0.4));
  return Math.round(lev * 0.4 + token * 0.6);
}

// ── Customer matching ──────────────────────────────────

/** Match a counterparty name (from bank) against known customers */
export function matchCustomer(
  counterpartyName: string,
  customers: MatchableCustomer[]
): MatchResult[] {
  if (!counterpartyName) return [];
  const name = counterpartyName.toLowerCase().trim();
  const results: MatchResult[] = [];

  for (const c of customers) {
    let bestScore = 0;
    let matchedOn = "";

    // 1. Exact substring on bankName
    if (c.bankName) {
      const sub = substringScore(c.bankName, name);
      if (sub > 0 && name.includes(c.bankName.toLowerCase())) {
        bestScore = Math.max(bestScore, 95);
        matchedOn = "bankName (exact)";
      } else if (sub > bestScore) {
        bestScore = sub;
        matchedOn = "bankName (substring)";
      }
    }

    // 2. Exact substring on aliases
    for (const alias of c.aliases) {
      if (name.includes(alias.toLowerCase())) {
        bestScore = Math.max(bestScore, 93);
        matchedOn = `alias "${alias}" (exact)`;
        break;
      }
    }

    // 3. Fuzzy on displayName
    if (bestScore < 90) {
      const lev = levenshteinScore(c.displayName, counterpartyName);
      const tok = tokenOverlap(c.displayName, counterpartyName);
      const sub = substringScore(c.displayName, counterpartyName);
      const score = combinedConfidence(lev, tok, sub);
      if (score > bestScore) {
        bestScore = score;
        matchedOn = "displayName (fuzzy)";
      }
    }

    // 4. Fuzzy on spreadsheetName
    if (bestScore < 90 && c.spreadsheetName) {
      const lev = levenshteinScore(c.spreadsheetName, counterpartyName);
      const tok = tokenOverlap(c.spreadsheetName, counterpartyName);
      const sub = substringScore(c.spreadsheetName, counterpartyName);
      const score = combinedConfidence(lev, tok, sub);
      if (score > bestScore) {
        bestScore = score;
        matchedOn = "spreadsheetName (fuzzy)";
      }
    }

    if (bestScore > 30) {
      results.push({
        id: c.id,
        label: c.displayName,
        confidence: bestScore,
        matchedOn,
      });
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence);
}

// ── Auto-resolution thresholds ──────────────────────────

/** Per-type confidence thresholds for auto-resolution */
export const AUTO_RESOLVE_THRESHOLDS: Record<string, number> = {
  customer_match: 95,   // Revenue-affecting: high bar
  engineer_split: 100,  // Always manual: never auto-resolve
};

/** Default threshold used when type is not found */
export const AUTO_RESOLVE_THRESHOLD = 90;
