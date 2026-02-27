import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { validateBody, customerSchema } from "@/lib/validations";

export async function GET() {
  const customers = await db.customer.findMany({
    where: { isActive: true },
    select: { id: true, displayName: true },
    orderBy: { displayName: "asc" },
  });
  return NextResponse.json({ customers });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const parsed = validateBody(z.object({ customers: z.array(customerSchema) }), body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { customers } = parsed.data;

  // Get existing active customer IDs
  const existing = await db.customer.findMany({ where: { isActive: true }, select: { id: true } });
  const existingIds = new Set(existing.map((c) => c.id));
  const incomingIds = new Set(
    customers
      .filter((c: { id: string }) => !c.id.startsWith("new-"))
      .map((c: { id: string }) => c.id)
  );

  // Soft-delete removed customers (set isActive: false instead of hard delete)
  for (const id of existingIds) {
    if (!incomingIds.has(id)) {
      await db.customer.update({ where: { id }, data: { isActive: false } });
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

    let saved;
    if (customer.id.startsWith("new-")) {
      saved = await db.customer.create({ data });
    } else {
      saved = await db.customer.update({
        where: { id: customer.id },
        data,
      });
    }
    result.push(saved);

    // Auto-promote domain mapping to "client" when customer has an emailDomain
    if (data.emailDomain) {
      await db.domainMapping.upsert({
        where: { domain: data.emailDomain.toLowerCase() },
        create: {
          domain: data.emailDomain.toLowerCase(),
          meetingType: "client",
          customerId: saved.id,
        },
        update: {
          meetingType: "client",
          customerId: saved.id,
        },
      });
    }
  }

  return NextResponse.json({ customers: result });
}
