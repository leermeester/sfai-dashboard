# Build dashboard approval queue UI

## Context

Part of the multi-interface resolution queue (parent). This is the first visual interface for the resolution queue — a card-stack UI where users can rapidly approve/reject/skip suggested matches. Think Tinder for data triage.

## Task

Create a new `/resolution` page in the dashboard with a card-stack interface. Each card shows one pending resolution item with its suggested match and confidence score. Users click or use keyboard shortcuts to approve, reject, or skip. A badge in the sidebar shows the pending count.

## Acceptance Criteria

- [ ] `/resolution` page shows pending items one at a time in a card layout
- [ ] Each card displays: source entity name, entity type icon, suggested match with confidence bar, relevant context (amount for transactions, meeting count for domains, etc.)
- [ ] Action buttons: [Approve suggested] [Pick different match ▾] [Create new entity] [Skip]
- [ ] Keyboard shortcuts: `y` approve, `n` reject, `s` skip, arrow keys to navigate if showing list view
- [ ] Filter tabs or toggles for item type: All / Transactions / Domains / Vendors / Sheet Names
- [ ] Stats banner at top: "X pending · Y auto-resolved today · Z confirmed"
- [ ] Sidebar navigation includes "Resolution" link with badge showing pending count
- [ ] Resolving an item animates it away and shows the next one
- [ ] Empty state when no items pending: "All caught up"

## Watch Out For

- **"Pick different match" flow**: When the user rejects the suggestion but knows the correct match, they need a dropdown/search to find the right customer. Reuse the existing customer selector pattern from `domain-mapping-form.tsx`.

## Pointers

- `src/app/(dashboard)/settings/page.tsx:89-211` — existing tab-based page layout pattern
- `src/components/forms/domain-mapping-form.tsx:129-170` — keyboard shortcut implementation pattern
- `src/components/ui/sidebar.tsx:580-600` — SidebarMenuBadge component for pending count badge
- `src/components/ui/card.tsx` — existing shadcn card component
- `src/components/ui/badge.tsx` — existing shadcn badge component
- `src/components/ui/progress.tsx` — for confidence bar display
