# Dashboard theme toggle

TopNav theme toggle persists preference to `localStorage` and respects
`prefers-color-scheme` on first visit. Apply `data-theme` on `<html>` before
hydration to avoid flash of incorrect theme.

See existing design tokens in `test/design-tokens.test.ts` for colour pairs.
