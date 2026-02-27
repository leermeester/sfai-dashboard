# Mandate AUTH_JWT_SECRET and CRON_SECRET — remove fallbacks

## Context

Part of Reliable Data Pipeline (parent). Both `middleware.ts` and `auth.ts` fall back to `"dev-secret-change-me"` if `AUTH_JWT_SECRET` is not set. The `CRON_SECRET` check is skipped entirely if the env var is undefined. In production, this means tokens become forgeable and cron endpoints become unprotected.

## Task

Remove the fallback secrets. Throw a clear startup error if required secrets are missing in production. Keep the fallback only for `NODE_ENV === "development"`.

## Acceptance Criteria

- [ ] If `AUTH_JWT_SECRET` is not set and `NODE_ENV !== "development"`, JWT signing/verification throws a clear error
- [ ] If `CRON_SECRET` is not set and `NODE_ENV !== "development"`, cron auth check still rejects requests (fail closed, not open)
- [ ] In development mode, fallback to `"dev-secret-change-me"` still works for local dev convenience
- [ ] Both `middleware.ts` and `auth.ts` use the same secret resolution logic (extract to shared function if needed)

## Pointers

- `src/middleware.ts:5-8` — `getSecret()` function with fallback
- `src/lib/auth.ts:5-7` — `SECRET` constant with fallback
- `src/middleware.ts:30-34` — `CRON_SECRET` check that's skipped if undefined
