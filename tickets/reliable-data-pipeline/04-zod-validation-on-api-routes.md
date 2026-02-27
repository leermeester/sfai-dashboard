# Add Zod schema validation to all API routes

## Context

Part of Reliable Data Pipeline (parent). API routes accept raw JSON via `request.json()` without validation. Invalid data (null names, malformed months, negative amounts) can persist in the database and corrupt downstream calculations.

## Task

Add Zod schemas for all API route request bodies. Validate incoming JSON before processing. Return 400 with clear error messages for invalid input.

## Acceptance Criteria

- [ ] `PUT /api/settings/customers` validates customer objects (displayName required, aliases is string array, etc.)
- [ ] `PUT /api/settings/team` validates team member objects (name required, role is enum, rates are positive numbers)
- [ ] `PUT /api/settings/allocations` validates month format (`YYYY-MM`), percentage is 0-100, teamMemberId and customerId are non-empty strings
- [ ] `POST /api/demand-forecast` validates forecastType is enum, hoursNeeded is positive
- [ ] `POST /api/resolution/[id]/resolve` validates action is one of `approve|reject|skip|manual`
- [ ] `GET /api/resolution` validates limit (1-100) and offset (>= 0) query params
- [ ] All validation errors return HTTP 400 with `{ error: "Validation error", details: [...] }`

## Watch Out For

- **Zod is already a dependency** (`package.json` line 28). No need to install.
- **Don't break existing clients**: Ensure the Zod schemas are permissive enough for current frontend code. Read the frontend forms to understand what shapes they send.

## Pointers

- `src/app/api/settings/customers/route.ts` — customers PUT
- `src/app/api/settings/team/route.ts` — team PUT
- `src/app/api/settings/allocations/route.ts:5-6` — allocations PUT (no validation on `month` or `allocations`)
- `src/app/api/demand-forecast/route.ts` — forecast POST
- `src/app/api/resolution/[id]/resolve/route.ts:12-19` — resolve POST (no validation on `body`)
- `src/app/api/resolution/route.ts:9-10` — resolution GET (parseInt without bounds)
