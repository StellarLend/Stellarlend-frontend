# Theming

How light / dark / system themes work in StellarLend.

## Modes

| Mode     | Behaviour                                              |
| -------- | ------------------------------------------------------ |
| `light`  | Force light tokens; ignore system preference.          |
| `dark`   | Force dark tokens; ignore system preference.           |
| `system` | Follow `prefers-color-scheme` (default).               |

## Persistence

- Key: `stellarlend-theme` in `localStorage`
- Values: `light` \| `dark` \| `system`
- Corrupted / missing values fall back to `system`
- Storage failures (private mode, quota) keep the in-memory choice for the session

## No-flash strategy

`app/layout.tsx` injects a tiny blocking script in `<head>` that:

1. Reads `localStorage['stellarlend-theme']`
2. Resolves system mode via `matchMedia('(prefers-color-scheme: dark)')`
3. Toggles the `dark` / `light` classes on `<html>` **before first paint**

The React `useTheme` hook rehydrates the same preference after mount and keeps
the class list in sync when the user toggles or the system preference changes.

## Application mechanism

- Class strategy: `document.documentElement.classList` gets `dark` or `light`
- `color-scheme` CSS property is set so native controls match
- Existing Tailwind `dark:` utilities activate via the class (see
  `@custom-variant dark` in `app/globals.css`)
- Design tokens in `constants/design-tokens.ts` remain the single source of
  truth for colour values; theming only selects which set is active

## UI

`ThemeToggle` in `TopNav` cycles light → dark → system. The control is a
keyboard-operable button with an `aria-label` that announces both the stored
mode and the currently resolved theme.

## Sources

- Hook: [`hooks/useTheme.ts`](../hooks/useTheme.ts)
- Toggle: [`components/shared/layout/ThemeToggle.tsx`](../components/shared/layout/ThemeToggle.tsx)
- Tests: [`hooks/useTheme.test.tsx`](../hooks/useTheme.test.tsx)
