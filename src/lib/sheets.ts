import { google } from "googleapis";

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

export interface RevenueCell {
  customer: string;
  month: string;
  amount: number;
}

export async function getSheetData(): Promise<RevenueCell[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

  if (!spreadsheetId) throw new Error("GOOGLE_SPREADSHEET_ID not set");

  // Read the full first sheet
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "A1:Z100", // Wide enough to capture all months and customers
  });

  const rows = res.data.values;
  if (!rows || rows.length < 2) return [];

  return parseRevenueMatrix(rows);
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
    return data.length >= 0; // Even empty is OK if connection works
  } catch {
    return false;
  }
}

export async function createSnapshot(db: import("@prisma/client").PrismaClient) {
  const cells = await getSheetData();
  const customers = await db.customer.findMany();
  const now = new Date();

  let created = 0;
  let unmatched: string[] = [];

  for (const cell of cells) {
    // Match sheet customer name to a Customer record
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
