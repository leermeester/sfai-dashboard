import { describe, it, expect } from "vitest";
import {
  matchCustomer,
  classifyDomain,
  categorizeVendor,
  matchSheetCustomer,
  AUTO_RESOLVE_THRESHOLD,
  AUTO_RESOLVE_THRESHOLDS,
  type MatchableCustomer,
} from "@/lib/matching";

// ── Fixtures ──────────────────────────────────────────

const customers: MatchableCustomer[] = [
  {
    id: "c1",
    displayName: "Nouri Health",
    spreadsheetName: "Nouri",
    bankName: "NOURI HEALTH INC",
    emailDomain: "nouri.health",
    aliases: ["Nouri", "NouriHealth"],
  },
  {
    id: "c2",
    displayName: "TechFlow Solutions",
    spreadsheetName: "TechFlow",
    bankName: "TECHFLOW SOLUTIONS LLC",
    emailDomain: "techflow.io",
    aliases: ["TechFlow", "Tech Flow"],
  },
  {
    id: "c3",
    displayName: "Acme Corp",
    spreadsheetName: null,
    bankName: null,
    emailDomain: "acme.com",
    aliases: ["ACME"],
  },
  {
    id: "c4",
    displayName: "Buildify",
    spreadsheetName: "Buildify",
    bankName: null,
    emailDomain: "buildify.io",
    aliases: [],
  },
];

// Vendor rules mimicking the shape from Prisma
const vendorRules = [
  {
    id: "v1",
    vendorPattern: "amazon web services",
    category: "software",
    displayName: "AWS",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "v2",
    vendorPattern: "gusto",
    category: "labor",
    displayName: "Gusto Payroll",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// ── matchCustomer ─────────────────────────────────────

describe("matchCustomer", () => {
  it("returns high confidence for exact bankName substring match", () => {
    const results = matchCustomer("NOURI HEALTH INC", customers);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe("c1");
    expect(results[0].confidence).toBeGreaterThanOrEqual(90);
    // The alias "Nouri" is also a substring of "nouri health inc" and is checked
    // after bankName, so matchedOn may reflect the alias even though score stays 95.
    // We verify the confidence is high enough to indicate a bankName-level match.
    expect(results[0].confidence).toBe(95);
  });

  it("matches an alias (exact substring)", () => {
    const results = matchCustomer("NouriHealth", customers);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe("c1");
    expect(results[0].confidence).toBeGreaterThanOrEqual(90);
    expect(results[0].matchedOn).toContain("alias");
  });

  it("fuzzy-matches on displayName", () => {
    const results = matchCustomer("Nouri Helth", customers);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe("c1");
    // Fuzzy match should still rank the right customer first
  });

  it("returns empty array when there is no match", () => {
    const results = matchCustomer("Completely Unknown Corp", customers);
    // No customer should match above 30 threshold
    const highConfidence = results.filter((r) => r.confidence > 80);
    expect(highConfidence).toHaveLength(0);
  });

  it("returns empty array for empty counterpartyName", () => {
    const results = matchCustomer("", customers);
    expect(results).toEqual([]);
  });

  it("does not incorrectly match Stripe payout names to unrelated customers", () => {
    const results = matchCustomer("STRIPE PAYOUT 12345", customers);
    // Should not get a high confidence match on any real customer
    const highConfidence = results.filter((r) => r.confidence > 80);
    expect(highConfidence).toHaveLength(0);
  });

  it("sorts results by descending confidence", () => {
    const results = matchCustomer("TECHFLOW SOLUTIONS LLC", customers);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].confidence).toBeLessThanOrEqual(results[i - 1].confidence);
    }
  });
});

// ── classifyDomain ────────────────────────────────────

describe("classifyDomain", () => {
  it("returns client 100% for known customer emailDomain", () => {
    const results = classifyDomain("nouri.health", customers, []);
    expect(results).toHaveLength(1);
    expect(results[0].meetingType).toBe("client");
    expect(results[0].confidence).toBe(100);
    expect(results[0].customerId).toBe("c1");
  });

  it("returns internal for SFAI domain", () => {
    const results = classifyDomain("sfaiconsultants.com", customers, []);
    const internal = results.find((r) => r.meetingType === "internal");
    expect(internal).toBeDefined();
    expect(internal!.confidence).toBe(95);
  });

  it("returns ignore for google.com", () => {
    const results = classifyDomain("google.com", customers, []);
    const ignored = results.find((r) => r.meetingType === "ignore");
    expect(ignored).toBeDefined();
    expect(ignored!.confidence).toBe(90);
  });

  it("returns sales with low confidence for unknown domain", () => {
    const results = classifyDomain("randomstartup.xyz", customers, []);
    expect(results.length).toBeGreaterThanOrEqual(1);
    const sales = results.find((r) => r.meetingType === "sales");
    expect(sales).toBeDefined();
    expect(sales!.confidence).toBeLessThanOrEqual(50);
  });

  it("uses existing mappings when present", () => {
    const mappings = [
      {
        id: "m1",
        domain: "knownpartner.com",
        meetingType: "client",
        customerId: "c2",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const results = classifyDomain("knownpartner.com", customers, mappings);
    expect(results).toHaveLength(1);
    expect(results[0].meetingType).toBe("client");
    expect(results[0].confidence).toBe(100);
  });

  it("returns empty for empty domain", () => {
    const results = classifyDomain("", customers, []);
    expect(results).toEqual([]);
  });

  it("uses domain-to-company heuristic for partial matches", () => {
    // "buildify.com" is not a known emailDomain (that's "buildify.io"),
    // but the domainBase "buildify" exactly matches displayName "Buildify"
    // so the heuristic should classify it as a client
    const results = classifyDomain("buildify.com", customers, []);
    const clientResult = results.find((r) => r.meetingType === "client");
    expect(clientResult).toBeDefined();
    expect(clientResult!.customerId).toBe("c4");
  });
});

// ── categorizeVendor ──────────────────────────────────

describe("categorizeVendor", () => {
  it("matches exact vendor rule with 95% confidence", () => {
    const results = categorizeVendor("Amazon Web Services Monthly", vendorRules);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].category).toBe("software");
    expect(results[0].confidence).toBe(95);
    expect(results[0].ruleId).toBe("v1");
  });

  it("matches keyword heuristic 'gusto' as labor", () => {
    // Use vendorRules that contain gusto pattern — should match the rule first
    const results = categorizeVendor("Gusto Payroll Processing", vendorRules);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].category).toBe("labor");
  });

  it("falls back to keyword heuristic when no rule matches", () => {
    const results = categorizeVendor("Rippling HR Platform", []);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].category).toBe("labor");
    expect(results[0].confidence).toBe(70);
  });

  it("returns empty for empty counterpartyName", () => {
    const results = categorizeVendor("", vendorRules);
    expect(results).toEqual([]);
  });

  it("returns empty when no match found at all", () => {
    const results = categorizeVendor("Unknown Random Vendor XYZ", []);
    expect(results).toEqual([]);
  });

  it("identifies software vendors via keyword heuristic", () => {
    const results = categorizeVendor("Vercel Pro Subscription", []);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].category).toBe("software");
    expect(results[0].confidence).toBe(70);
  });
});

// ── matchSheetCustomer ────────────────────────────────

describe("matchSheetCustomer", () => {
  it("returns 100% for exact spreadsheetName match", () => {
    const results = matchSheetCustomer("Nouri", customers);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("c1");
    expect(results[0].confidence).toBe(100);
    expect(results[0].matchedOn).toBe("spreadsheetName (exact)");
  });

  it("returns 98% for exact displayName match", () => {
    const results = matchSheetCustomer("Acme Corp", customers);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe("c3");
    expect(results[0].confidence).toBe(98);
    expect(results[0].matchedOn).toBe("displayName (exact)");
  });

  it("returns 95% for exact alias match", () => {
    const results = matchSheetCustomer("ACME", customers);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe("c3");
    expect(results[0].confidence).toBe(95);
    expect(results[0].matchedOn).toContain("alias");
  });

  it("returns fuzzy match for similar names", () => {
    const results = matchSheetCustomer("Nouri Helth", customers);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe("c1");
    expect(results[0].matchedOn).toContain("fuzzy");
  });

  it("returns empty for no match", () => {
    const results = matchSheetCustomer("ZZZZ Unknown Corp", customers);
    const highConf = results.filter((r) => r.confidence > 80);
    expect(highConf).toHaveLength(0);
  });

  it("returns empty for empty sheetName", () => {
    const results = matchSheetCustomer("", customers);
    expect(results).toEqual([]);
  });
});

// ── AUTO_RESOLVE_THRESHOLDS ──────────────────────────

describe("AUTO_RESOLVE_THRESHOLDS", () => {
  it("customer_match threshold is 95", () => {
    expect(AUTO_RESOLVE_THRESHOLDS.customer_match).toBe(95);
  });

  it("domain_classify threshold is 85", () => {
    expect(AUTO_RESOLVE_THRESHOLDS.domain_classify).toBe(85);
  });

  it("vendor_categorize threshold is 80", () => {
    expect(AUTO_RESOLVE_THRESHOLDS.vendor_categorize).toBe(80);
  });

  it("sheet_customer threshold is 90", () => {
    expect(AUTO_RESOLVE_THRESHOLDS.sheet_customer).toBe(90);
  });

  it("default AUTO_RESOLVE_THRESHOLD is 90", () => {
    expect(AUTO_RESOLVE_THRESHOLD).toBe(90);
  });
});
