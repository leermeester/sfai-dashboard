export interface RevenueCell {
  customer: string;
  month: string;
  amount: number;
}

export async function getSheetData(): Promise<RevenueCell[]> {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SPREADSHEET_ID not set");

  // Fetch CSV export directly (requires "Anyone with the link" access)
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Sheets fetch failed: ${res.status}`);

  const csv = await res.text();
  const rows = parseCsv(csv);
  if (rows.length < 2) return [];

  return parseRevenueMatrix(rows);
}

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (inQuotes) {
      if (ch === '"' && csv[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(current);
        current = "";
      } else if (ch === "\n" || (ch === "\r" && csv[i + 1] === "\n")) {
        row.push(current);
        current = "";
        rows.push(row);
        row = [];
        if (ch === "\r") i++;
      } else {
        current += ch;
      }
    }
  }
  if (current || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows;
}

export function parseRevenueMatrix(rows: string[][]): RevenueCell[] {
  const cells: RevenueCell[] = [];
  const headerRow = rows[0];

  // Find month columns - skip first column (customer names)
  const monthColumns: { index: number; month: string }[] = [];
  for (let i = 1; i < headerRow.length; i++) {
    const month = normalizeMonth(headerRow[i]);
    if (month) {
      monthColumns.push({ index: i, month });
    }
  }

  // Parse customer rows
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const customer = row[0]?.trim();
    if (!customer) continue;

    for (const { index, month } of monthColumns) {
      const rawValue = row[index]?.trim();
      if (!rawValue) continue;

      const amount = parseAmount(rawValue);
      if (amount !== null && amount > 0) {
        cells.push({ customer, month, amount });
      }
    }
  }

  return cells;
}

function normalizeMonth(header: string): string | null {
  if (!header) return null;
  const trimmed = header.trim();

  // Try "YYYY-MM" format
  if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed;

  // Try "Jan 2026", "January 2026", "Jan '26", etc.
  const monthNames: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04",
    may: "05", jun: "06", jul: "07", aug: "08",
    sep: "09", oct: "10", nov: "11", dec: "12",
  };

  const match = trimmed.match(/^(\w+)\s*['']?(\d{2,4})$/i);
  if (match) {
    const monthKey = match[1].toLowerCase().slice(0, 3);
    const monthNum = monthNames[monthKey];
    if (monthNum) {
      let year = match[2];
      if (year.length === 2) year = `20${year}`;
      return `${year}-${monthNum}`;
    }
  }

  // Try "MM/YYYY" or "M/YYYY"
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    return `${slashMatch[2]}-${slashMatch[1].padStart(2, "0")}`;
  }

  return null;
}

function parseAmount(value: string): number | null {
  // Remove currency symbols, commas, and spaces
  const cleaned = value.replace(/[$€£,\s]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export async function testConnection(): Promise<boolean> {
  try {
    const data = await getSheetData();
    return data.length >= 0;
  } catch {
    return false;
  }
}

export async function createSnapshot(db: import("@prisma/client").PrismaClient) {
  const cells = await getSheetData();
  const customers = await db.customer.findMany();
  const now = new Date();

  let created = 0;
  const unmatched: string[] = [];

  for (const cell of cells) {
    const customer = customers.find((c) => {
      const sheetName = cell.customer.toLowerCase();
      if (c.spreadsheetName?.toLowerCase() === sheetName) return true;
      if (c.displayName.toLowerCase() === sheetName) return true;
      return c.aliases.some((a) => a.toLowerCase() === sheetName);
    });

    if (!customer) {
      if (!unmatched.includes(cell.customer)) {
        unmatched.push(cell.customer);
      }
      continue;
    }

    await db.salesSnapshot.create({
      data: {
        customerId: customer.id,
        month: cell.month,
        snapshotDate: now,
        amount: cell.amount,
      },
    });
    created++;
  }

  return { created, unmatched };
}
