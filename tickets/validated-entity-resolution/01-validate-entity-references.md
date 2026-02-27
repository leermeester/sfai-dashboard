# Validate entity references before applying resolution

## Context

Part of Validated Entity Resolution (parent). `applyResolution()` uses `decision.customerId` directly in database updates without verifying the customer exists. If a stale or malformed customerId reaches this function, bank transactions get assigned to a non-existent customer.

## Task

Before applying any side effects in `applyResolution()`, validate that referenced entities exist in the database. For `customer_match` and `sheet_customer`, verify `customerId` resolves to an active customer. For `vendor_categorize`, verify the category is one of the allowed values. For `domain_classify`, verify meetingType is valid.

## Acceptance Criteria

- [ ] `customer_match` resolution throws if `customerId` doesn't exist in the Customer table
- [ ] `sheet_customer` resolution throws if `customerId` doesn't exist
- [ ] `vendor_categorize` resolution throws if `category` is not one of `["labor", "software", "other"]`
- [ ] `domain_classify` resolution throws if `meetingType` is not one of `["client", "sales", "internal", "ignore"]`
- [ ] Error messages are descriptive (e.g., "Customer with ID xyz not found")
- [ ] Validation errors cause the entire resolution to fail (no partial side effects — relies on transaction from Trustworthy Financials milestone)

## Pointers

- `src/lib/resolution-queue.ts:206-339` — `applyResolution()` — add validation at the top of each case branch
- `src/lib/resolution-queue.ts:215` — first use of `decision.customerId` without check
