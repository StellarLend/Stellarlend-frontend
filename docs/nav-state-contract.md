# Nav-State Contract

Defines the single source of truth for focus-visible rings, active states, and touch targets across all navigation components.

## Tokens (`constants/design-tokens.ts`)

| Export | Key | Value | Purpose |
|---|---|---|---|
| `navTokens` | `focusRing` | `#15A350` | Focus-visible ring colour |
| `navTokens` | `activeText` | `#15A350` | Active link text colour |
| `navTokens` | `activeBgLight` | `#15A350/10` | Active bg — light context |
| `navTokens` | `activeBgDark` | `#15A350/15` | Active bg — dark context |
| `navTokens` | `inactiveText` | `#AAABAB` | Default/inactive text |
| `navTokens` | `indicatorBar` | `#15A350` | Left-edge active bar |
| `navTokens` | `minTouchTarget` | `2.75rem` (44 px) | WCAG 2.5.5 touch target |
| `navClasses` | `base` | Tailwind string | Applied to every nav link |
| `navClasses` | `touchTarget` | `py-3.5` | Minimum 44 px height |
| `navClasses` | `active` | Tailwind string | Light-context active state |
| `navClasses` | `activeDark` | Tailwind string | Dark-context active state |
| `navClasses` | `inactive` | Tailwind string | Light-context inactive |
| `navClasses` | `inactiveDark` | Tailwind string | Dark-context inactive |

## Active-state detection

- **NavLink** — compares `usePathname()` to `href`. Override with the `isActive` boolean prop (useful in Storybook or hash-link contexts).
- **NavigationMenu** — uses a two-tier active-state strategy:
  - Links **with a `path`** (Dashboard, Loan, Transactions, Settings, …): active state is derived from `usePathname()` matching `link.path`.
  - Links **without a `path`** (Fundwallet, Lending, Log Out): active state is tracked via `localStorage` key `"activeLink"`. The stored value is read on mount and written on every click via `handleClick`.
  - `localStorage` is therefore both read (`getItem("activeLink")` inside `useEffect`) and written (`setItem("activeLink", linkName)` inside the click handler).
- Hash links (`href` starting with `#`) are never marked active by pathname comparison.

## Focus-visible ring

All interactive nav elements use:

```
focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15A350] focus-visible:ring-offset-2
```

- `focus:outline-none` suppresses the browser default only when `:focus-visible` is also applied.
- The ring is **only** shown for keyboard/programmatic focus (`:focus-visible`), not on mouse click.
- On dark backgrounds (SideNav, NavigationMenu) add `focus-visible:ring-offset-black` to ensure contrast.
- TopNav buttons use `focus-visible:ring-offset-green-600` to match the green header background.

## Touch targets

Every nav link and button must have a minimum interactive area of **44 × 44 px** (WCAG 2.5.5).  
`navClasses.touchTarget` (`py-3.5`) achieves this for standard text-size links.

## Component responsibilities

| Component | Responsibility |
|---|---|
| `NavLink` | Renders a single link with token-based active/focus styles; exposes `isActive` override |
| `NavigationMenu` | Renders the full sidebar link list; derives active state from URL for path-based links; uses `localStorage` key `"activeLink"` for path-less links (Fundwallet, Lending, Log Out) |
| `Navbar` | Marketing header; uses `NavLink` for hash links, applies `focus-visible` to CTA buttons |
| `TopNav` | Dashboard top bar; all buttons use `focusClasses` constant (same ring colour) |
| `SideNav` | Sidebar shell; close button has `aria-label="Close sidebar"` and `focus-visible` ring |

## Adding a new nav link

1. Add the entry to the `links` array in `NavigationMenu.tsx` with a `path`.
2. Use `NavLink` for standalone links — no extra className needed for focus/active.
3. Do **not** hardcode `#15A350` or `#AAABAB` — import from `navTokens`/`navClasses`.

## Testing

Tests live in `components/shared/layout/NavigationStates.test.tsx` and run under the `accessibility` vitest project.

Each nav component is verified for:
- `aria-current="page"` on the active link
- `focus-visible:ring-2` and `focus-visible:ring-[#15A350]` present on all links
- `py-3.5` touch-target class present
- `localStorage.getItem("activeLink")` is called on `NavigationMenu` mount (covers path-less links)
- `localStorage.setItem("activeLink", …)` is called when any link is clicked
- `aria-label` on the SideNav close button

Run with:

```bash
npx vitest run --project accessibility
```
