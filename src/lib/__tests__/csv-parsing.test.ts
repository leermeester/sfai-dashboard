import { describe, it, expect } from "vitest";
import {
  parseCsv,
  normalizeMonth,
  parseAmount,
  parseRevenueMatrix,
} from "@/lib/sheets";

// ── parseCsv ──────────────────────────────────────────

describe("parseCsv", () => {
  it("parses a simple CSV", () => {
    const csv = "a,b,c\n1,2,3";
    const rows = parseCsv(csv);
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with commas", () => {
    const csv = '"hello, world",b,c';
    const rows = parseCsv(csv);
    expect(rows).toEqual([["hello, world", "b", "c"]]);
  });

  it("handles embedded double quotes", () => {
    const csv = '"He said ""hi""",b';
    const rows = parseCsv(csv);
    expect(rows).toEqual([['He said "hi"', "b"]]);
  });

  it("handles empty cells", () => {
    const csv = "a,,c\n,b,";
    const rows = parseCsv(csv);
    expect(rows).toEqual([
      ["a", "", "c"],
      ["", "b", ""],
    ]);
  });

  it("returns empty array for empty input", () => {
    const rows = parseCsv("");
    // Empty string: current="" and row.length=0, so the final guard skips pushing
    expect(rows).toEqual([]);
  });

  it("handles no trailing newline", () => {
    const csv = "a,b\nc,d";
    const rows = parseCsv(csv);
    expect(rows).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("handles CRLF line endings", () => {
    const csv = "a,b\r\nc,d\r\n";
    const rows = parseCsv(csv);
    expect(rows).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });
});

// ── normalizeMonth ────────────────────────────────────

describe("normalizeMonth", () => {
  it("passes through YYYY-MM format", () => {
    expect(normalizeMonth("2026-01")).toBe("2026-01");
  });

  it("parses 'Jan 2026'", () => {
    expect(normalizeMonth("Jan 2026")).toBe("2026-01");
  });

  it("parses 'January 2026'", () => {
    expect(normalizeMonth("January 2026")).toBe("2026-01");
  });

  it("parses 'Jan '26' (short year with apostrophe)", () => {
    expect(normalizeMonth("Jan '26")).toBe("2026-01");
  });

  it("parses '08/2026' (MM/YYYY)", () => {
    expect(normalizeMonth("08/2026")).toBe("2026-08");
  });

  it("parses bare 'Jan' with defaultYear=2026", () => {
    expect(normalizeMonth("Jan", 2026)).toBe("2026-01");
  });

  it("returns null for invalid input", () => {
    expect(normalizeMonth("not a month")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeMonth("")).toBeNull();
  });

  it("strips bracket annotations like 'August [1-22]'", () => {
    expect(normalizeMonth("August [1-22]", 2025)).toBe("2025-08");
  });

  it("parses single-digit month in slash format", () => {
    expect(normalizeMonth("1/2025")).toBe("2025-01");
  });
});

// ── parseAmount ───────────────────────────────────────

describe("parseAmount", () => {
  it("parses '$1,000'", () => {
    expect(parseAmount("$1,000")).toBe(1000);
  });

  it("parses '1000.50'", () => {
    expect(parseAmount("1000.50")).toBe(1000.5);
  });

  it("parses '$1,000,000'", () => {
    expect(parseAmount("$1,000,000")).toBe(1000000);
  });

  it("returns null for non-numeric 'x'", () => {
    expect(parseAmount("x")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseAmount("")).toBeNull();
  });

  it("parses negative '-500'", () => {
    expect(parseAmount("-500")).toBe(-500);
  });
});

// ── parseRevenueMatrix ────────────────────────────────

describe("parseRevenueMatrix", () => {
  it("parses a valid matrix with header row", () => {
    const rows = [
      ["Customer", "Jan", "Feb", "Mar"],
      ["Nouri", "$10,000", "$12,000", "$11,000"],
      ["TechFlow", "$5,000", "", "$6,000"],
    ];
    const cells = parseRevenueMatrix(rows);
    // Nouri: 3 months, TechFlow: 2 months (Feb is empty)
    expect(cells).toHaveLength(5);
    expect(cells[0]).toEqual({ customer: "Nouri", month: "2025-01", amount: 10000 });
    expect(cells[1]).toEqual({ customer: "Nouri", month: "2025-02", amount: 12000 });
    expect(cells[2]).toEqual({ customer: "Nouri", month: "2025-03", amount: 11000 });
    expect(cells[3]).toEqual({ customer: "TechFlow", month: "2025-01", amount: 5000 });
    expect(cells[4]).toEqual({ customer: "TechFlow", month: "2025-03", amount: 6000 });
  });

  it("detects year rollover (Dec -> Jan)", () => {
    const rows = [
      ["Customer", "Nov", "Dec", "Jan", "Feb"],
      ["Nouri", "$1,000", "$2,000", "$3,000", "$4,000"],
    ];
    const cells = parseRevenueMatrix(rows);
    expect(cells).toHaveLength(4);
    expect(cells[0].month).toBe("2025-11");
    expect(cells[1].month).toBe("2025-12");
    // After Dec, year should roll over to 2026
    expect(cells[2].month).toBe("2026-01");
    expect(cells[3].month).toBe("2026-02");
  });

  it("stops parsing when section terminator is reached", () => {
    const rows = [
      ["Customer", "Jan", "Feb"],
      ["Nouri", "$10,000", "$12,000"],
      ["SFAI", "$5,000", "$6,000"],     // section terminator
      ["Internal Team", "$1,000", "$2,000"], // should NOT be parsed
    ];
    const cells = parseRevenueMatrix(rows);
    // Only Nouri should be parsed (2 cells)
    expect(cells).toHaveLength(2);
    expect(cells.every((c) => c.customer === "Nouri")).toBe(true);
  });

  it("skips names in the skip list (total, subtotal, etc.)", () => {
    const rows = [
      ["Customer", "Jan"],
      ["Nouri", "$10,000"],
      ["Total", "$10,000"],
      ["TechFlow", "$5,000"],
    ];
    const cells = parseRevenueMatrix(rows);
    const customerNames = cells.map((c) => c.customer);
    expect(customerNames).not.toContain("Total");
    expect(customerNames).toContain("Nouri");
    expect(customerNames).toContain("TechFlow");
  });

  it("returns empty for less than 2 rows (handled by caller getSheetData)", () => {
    // parseRevenueMatrix itself doesn't check length, but with only a header
    // no data rows means no cells
    const rows = [["Customer", "Jan"]];
    const cells = parseRevenueMatrix(rows);
    expect(cells).toHaveLength(0);
  });
});
