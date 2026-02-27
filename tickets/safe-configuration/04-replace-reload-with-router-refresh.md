# Replace window.location.reload with router.refresh

## Context

Part of Safe Configuration (parent). Multiple forms use `window.location.reload()` after successful saves. This causes a full page reload that loses scroll position, browser state, and can mask errors if the reload itself fails. Next.js's `router.refresh()` revalidates Server Component data without a full page reload.

## Task

Replace all `window.location.reload()` calls with `router.refresh()` from `next/navigation`. Also add error handling for failed saves — currently some forms don't check `res.ok` before reloading.

## Acceptance Criteria

- [ ] All `window.location.reload()` calls replaced with `router.refresh()`
- [ ] Forms check `res.ok` before refreshing; show error message on failure
- [ ] Scroll position is preserved after save
- [ ] SyncButton shows error state when sync fails (currently fails silently)

## Pointers

- `src/components/forms/time-allocation-form.tsx:136,176` — reload after allocation save
- `src/components/forms/demand-forecast-form.tsx:196` — reload after forecast save
- `src/components/forms/domain-mapping-form.tsx:188` — reload after domain save
- `src/components/forms/sync-button.tsx:15` — reload after sync
- `src/components/forms/api-status-panel.tsx:44-54` — uses `alert()` for feedback; replace with inline state
