# NavigationMenu & Breadcrumbs

Route-aware sidebar navigation and breadcrumb trail for the Stellarlend dashboard.

---

## NavigationMenu

`components/shared/layout/NavigationMenu.tsx`

### Overview

Renders the main sidebar link list. Active state is derived from the current
pathname via Next.js `usePathname()` — no manual state sync needed.

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `visibleLinks` | `string[]` | all links | Subset of link names to render |
| `onLinkClick` | `() => void` | — | Called on every link click (e.g. close mobile drawer) |
| `isCollapsed` | `boolean` | `false` | Icon-only collapsed mode (text hidden via `sr-only`) |

### Active state logic

```
link has path  →  active when pathname === link.path   (exact match)
link has no path  →  active when localStorage activeLink matches (click-based)
```

**No double-active**: each link uses exact `===` comparison, so a parent route
(`/dashboard`) and a child route (`/dashboard/transactions`) are never both
active at once.

### Accessibility

- `<nav aria-label="Main navigation">` landmark.
- Active link carries `aria-current="page"`.
- Active state is conveyed by background tint + left indicator bar — not by color alone (WCAG 1.4.1).
- All links have `focus-visible:ring-2` keyboard focus rings.
- Minimum touch target height: `py-3.5` (≥ 44 px, WCAG 2.5.5).

### Usage

```tsx
<NavigationMenu
  visibleLinks={["Dashboard", "Transactions", "Settings"]}
  onLinkClick={() => setSidebarOpen(false)}
  isCollapsed={isCollapsed}
/>
```

---

## Breadcrumbs

`components/shared/layout/Breadcrumbs.tsx`

### Overview

Derives a breadcrumb trail from the current pathname. Automatically handles:

- Known segments (`dashboard`, `transactions`, `settings`, etc.)
- Dynamic segments — UUIDs and numeric IDs render as `"Details"`.
- Unknown segments — title-cased with hyphens replaced by spaces.
- Trailing slash normalisation.

Returns `null` when there is only one segment (root or single-level page).

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `items` | `BreadcrumbItem[]` | auto-derived | Override crumbs (useful in stories/tests) |
| `className` | `string` | `""` | Extra classes on the `<nav>` element |

### Examples

| Pathname | Rendered trail |
|---|---|
| `/` | *(nothing rendered)* |
| `/dashboard` | *(nothing rendered)* |
| `/dashboard/transactions` | Home / Dashboard / **Transactions** |
| `/dashboard/transactions/550e8400-…` | Home / Dashboard / Transactions / **Details** |
| `/dashboard/some-feature` | Home / Dashboard / **Some feature** |

### Usage

```tsx
// Auto-derived from pathname
<Breadcrumbs className="mb-4" />

// Explicit override
<Breadcrumbs items={[
  { label: "Home", href: "/" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Transaction #42", href: "/dashboard/transactions/42" },
]} />
```

### Accessibility

- `<nav aria-label="Breadcrumb">` landmark (ARIA Authoring Practices).
- Current (last) item carries `aria-current="page"` and is plain text, not a link.
- All intermediate links have `focus-visible:ring-2` keyboard focus rings.

### `buildCrumbs` helper

Exported separately for unit testing or server-side use:

```ts
import { buildCrumbs } from "@/components/shared/layout/Breadcrumbs";

buildCrumbs("/dashboard/transactions");
// [
//   { label: "Home", href: "/" },
//   { label: "Dashboard", href: "/dashboard" },
//   { label: "Transactions", href: "/dashboard/transactions" },
// ]
```

---

## Adding a new segment label

Edit the `SEGMENT_LABELS` map in `Breadcrumbs.tsx`:

```ts
const SEGMENT_LABELS: Record<string, string> = {
  // …existing entries…
  "new-feature": "New Feature",
};
```

---

## Testing

```bash
npm test -- NavigationMenu
```

Coverage targets: ≥ 95 % on new/changed lines.

Key edge cases covered:

| Scenario | Test |
|---|---|
| Root path `/` | `buildCrumbs` returns Home only, component renders nothing |
| Nested dynamic route `/dashboard/transactions/[id]` | Label shown as "Details" |
| Trailing slash `/dashboard/` | Treated same as `/dashboard` |
| Unknown segment `/dashboard/xyz` | Title-cased fallback |
| No double-active (parent + child both in nav) | Only exact match is active |
| localStorage restore on mount | Saved active link re-applied |
