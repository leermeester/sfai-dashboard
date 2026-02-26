import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(request: Request) {
  const { customers } = await request.json();

  // Get existing customer IDs
  const existing = await db.customer.findMany({ select: { id: true } });
  const existingIds = new Set(existing.map((c) => c.id));
  const incomingIds = new Set(
    customers
      .filter((c: { id: string }) => !c.id.startsWith("new-"))
      .map((c: { id: string }) => c.id)
  );

  // Delete removed customers
  for (const id of existingIds) {
    if (!incomingIds.has(id)) {
      await db.customer.delete({ where: { id } });
    }
  }

  // Upsert customers
  const result = [];
  for (const customer of customers) {
    const data = {
      displayName: customer.displayName,
      spreadsheetName: customer.spreadsheetName || null,
      bankName: customer.bankName || null,
      emailDomain: customer.emailDomain || null,
      linearProjectId: customer.linearProjectId || null,
      email: customer.email || null,
      aliases: customer.aliases ?? [],
      isActive: customer.isActive ?? true,
    };

    if (customer.id.startsWith("new-")) {
      const created = await db.customer.create({ data });
      result.push(created);
    } else {
      const updated = await db.customer.update({
        where: { id: customer.id },
        data,
      });
      result.push(updated);
    }
  }

  return NextResponse.json({ customers: result });
}
