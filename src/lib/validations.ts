import { z } from "zod";

// ---------------------------------------------------------------------------
// 1. customerSchema – PUT /api/settings/customers (single item in array)
// ---------------------------------------------------------------------------
export const customerSchema = z.object({
  id: z.string(),
  displayName: z.string().min(1),
  spreadsheetName: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
  emailDomain: z.string().nullable().optional(),
  linearProjectId: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  aliases: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

export type Customer = z.infer<typeof customerSchema>;

// ---------------------------------------------------------------------------
// 2. teamMemberSchema – PUT /api/settings/team (single item in array)
// ---------------------------------------------------------------------------
export const teamMemberSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  email: z.string().email().nullable().optional(),
  role: z.string(),
  hourlyRate: z.number().positive().nullable().optional(),
  monthlyCost: z.number().positive().nullable().optional(),
  isActive: z.boolean().default(true),
  linearUserId: z.string().nullable().optional(),
  mercuryCounterparty: z.string().nullable().optional(),
});

export type TeamMember = z.infer<typeof teamMemberSchema>;

// ---------------------------------------------------------------------------
// 3. allocationSchema – single allocation row
// ---------------------------------------------------------------------------
export const allocationSchema = z.object({
  teamMemberId: z.string().min(1),
  customerId: z.string().min(1),
  week: z.number().int().min(1).max(5),
  percentage: z.number().min(0).max(100),
  source: z.enum(["manual", "linear"]).default("manual"),
});

export type Allocation = z.infer<typeof allocationSchema>;

// ---------------------------------------------------------------------------
// 4. allocationsPayloadSchema – PUT /api/settings/allocations
// ---------------------------------------------------------------------------
export const allocationsPayloadSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format"),
  allocations: z.array(allocationSchema),
});

export type AllocationsPayload = z.infer<typeof allocationsPayloadSchema>;

// ---------------------------------------------------------------------------
// 5. demandForecastSchema – single forecast row (legacy)
// ---------------------------------------------------------------------------
export const demandForecastSchema = z.object({
  customerId: z.string().min(1),
  teamMemberId: z.string().nullable().optional(),
  hoursNeeded: z.number().positive(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
  notes: z.string().optional(),
});

export type DemandForecast = z.infer<typeof demandForecastSchema>;

// ---------------------------------------------------------------------------
// 6. forecastPayloadSchema – PUT /api/demand-forecast (legacy)
// ---------------------------------------------------------------------------
export const forecastPayloadSchema = z.object({
  forecasts: z.array(demandForecastSchema),
  forecastType: z.enum(["this_week", "next_week"]),
});

export type ForecastPayload = z.infer<typeof forecastPayloadSchema>;

// ---------------------------------------------------------------------------
// 6b. capacityForecastSchema – PUT /api/capacity/forecast (new weekStart-based)
// ---------------------------------------------------------------------------
export const capacityForecastSchema = z.object({
  customerId: z.string().min(1),
  teamMemberId: z.string().nullable().optional(),
  weekStart: z.string().min(1), // ISO 8601 date string (Monday)
  ticketsNeeded: z.number().min(0).optional(),
  hoursNeeded: z.number().min(0).optional(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
  notes: z.string().optional(),
  source: z.enum(["manual", "linear", "carry_forward"]).default("manual"),
});

export type CapacityForecast = z.infer<typeof capacityForecastSchema>;

export const capacityForecastPayloadSchema = z.object({
  forecasts: z.array(capacityForecastSchema),
});

export type CapacityForecastPayload = z.infer<typeof capacityForecastPayloadSchema>;

export const confirmWeekPayloadSchema = z.object({
  weekStart: z.string().min(1),
  forecasts: z.array(capacityForecastSchema.omit({ weekStart: true })),
});

export type ConfirmWeekPayload = z.infer<typeof confirmWeekPayloadSchema>;

// ---------------------------------------------------------------------------
// 7. resolveDecisionSchema – POST /api/resolution/[id]/resolve
// ---------------------------------------------------------------------------
export const resolveDecisionSchema = z.object({
  action: z.enum(["approve", "reject", "skip", "manual"]),
  customerId: z.string().optional(),
  bankName: z.string().optional(),
  channel: z.string().default("dashboard"),
  engineerSplits: z.array(z.object({
    teamMemberId: z.string(),
    amount: z.number().positive(),
  })).optional(),
});

export type ResolveDecision = z.infer<typeof resolveDecisionSchema>;

// ---------------------------------------------------------------------------
// 8. resolutionQuerySchema – GET /api/resolution (query params)
// ---------------------------------------------------------------------------
export const resolutionQuerySchema = z.object({
  status: z
    .enum(["pending", "auto_resolved", "confirmed", "rejected"])
    .default("pending"),
  type: z
    .enum([
      "customer_match",
      "engineer_split",
    ])
    .optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export type ResolutionQuery = z.infer<typeof resolutionQuerySchema>;

// ---------------------------------------------------------------------------
// 9. domainMappingSchema – PUT /api/settings/domains (single item in array)
// ---------------------------------------------------------------------------
export const domainMappingSchema = z.object({
  domain: z.string().min(1),
  meetingType: z.enum(["client", "sales", "internal", "ignore"]),
  customerId: z.string().nullable(),
});

export type DomainMapping = z.infer<typeof domainMappingSchema>;

// ---------------------------------------------------------------------------
// 10. vendorRuleSchema – PUT /api/settings/vendor-categories (single item)
// ---------------------------------------------------------------------------
export const vendorRuleSchema = z.object({
  id: z.string(),
  vendorPattern: z.string().min(1),
  category: z.enum(["labor", "software", "other"]),
  displayName: z.string().nullable().optional(),
});

export type VendorRule = z.infer<typeof vendorRuleSchema>;

// ---------------------------------------------------------------------------
// 11. mercuryActionSchema – POST /api/mercury (discriminated union on action)
// ---------------------------------------------------------------------------
export const mercuryActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("categorize"),
    txnId: z.string(),
    costCategory: z.string(),
  }),
  z.object({
    action: z.literal("reconcile"),
    txnId: z.string(),
    customerId: z.string(),
  }),
  z.object({
    action: z.literal("sync"),
  }),
]);

export type MercuryAction = z.infer<typeof mercuryActionSchema>;

// ---------------------------------------------------------------------------
// Helper: validateBody
// ---------------------------------------------------------------------------
export function validateBody<T>(
  schema: z.ZodType<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string; details: z.ZodError["issues"] } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    details: result.error.issues,
  };
}
