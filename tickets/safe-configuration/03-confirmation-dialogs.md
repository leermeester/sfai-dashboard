# Add confirmation dialogs for destructive actions

## Context

Part of Safe Configuration (parent). Delete buttons in settings forms (team config, customer mapping, vendor categories) remove rows from local state immediately with no confirmation. While changes aren't persisted until "Save All" is clicked, accidental deletions are disorienting and can only be undone by reloading (losing all other edits).

## Task

Add a confirmation dialog (shadcn AlertDialog) before removing rows in all settings forms. The dialog should show what's being deleted and warn about consequences.

## Acceptance Criteria

- [ ] Clicking the trash icon on TeamConfigForm shows a confirmation dialog before removing the row
- [ ] Clicking the trash icon on CustomerMappingForm shows a confirmation dialog
- [ ] Clicking the trash icon on VendorCategoryForm shows a confirmation dialog
- [ ] Dialog includes the entity name (e.g., "Remove John Smith?") and a brief warning
- [ ] Cancel returns to the form without changes; Confirm removes the row

## Pointers

- `src/components/forms/team-config-form.tsx:70-72` — `removeMember()` function; add dialog trigger
- `src/components/forms/customer-mapping-form.tsx:85-87` — `removeCustomer()` function
- `src/components/forms/vendor-category-form.tsx:90-92` — `removeRule()` function
- `src/components/ui/alert-dialog.tsx` — shadcn AlertDialog component (already installed)
