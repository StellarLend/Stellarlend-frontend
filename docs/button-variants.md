# Button Variants and Migration

This project now uses a single canonical `Button` component across the repo.

## Canonical component

- `components/atoms/Button/Button.tsx` is the source of truth for button behavior.
- `components/shared/ui/Button.tsx` re-exports the canonical button so existing imports remain compatible.

## Supported variants

- `primary` — main call-to-action style with brand green background.
- `secondary` — neutral solid button for secondary actions.
- `ghost` — low-emphasis button with transparent background.
- `destructive` — destructive action style for delete/remove states.

### Legacy compatibility

- `danger` is preserved as an alias of `destructive` to support existing usages.
- `outline` and `success` are also still available for backward-compatible button styles.

## Supported sizes

- `sm`
- `md`
- `lg`

## Accessibility and focus

- Buttons include a strong `focus-visible` ring around the button.
- Loading buttons are disabled while showing a spinner.
- Full-width buttons can be enabled with `fullWidth`.

## Migration notes

- Existing imports from `@/components/shared/ui/Button` continue to work.
- New or migrated imports should prefer the shared UI path:

```ts
import Button from '@/components/shared/ui/Button';
```

- If the button is imported from `components/atoms/Button` in tests or atoms-specific code, it remains the same.
