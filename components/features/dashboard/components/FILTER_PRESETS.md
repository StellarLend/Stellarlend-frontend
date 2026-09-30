# Saved Filter Presets

A preset bar for the transactions page that stores named filter combinations
(e.g. _"Borrows last 30 days"_) in `localStorage` and applies them to the URL in
one click.

- Component: [`FilterPresets.tsx`](./FilterPresets.tsx)
- Persistence/serialisation helpers: [`lib/transactions/presets.ts`](../../../../lib/transactions/presets.ts)
- Tests: [`FilterPresets.test.tsx`](./FilterPresets.test.tsx), [`lib/transactions/presets.test.ts`](../../../../lib/transactions/presets.test.ts)
- Mounted in: [`app/dashboard/transactions/page.tsx`](../../../../app/dashboard/transactions/page.tsx)

## Usage

```tsx
import FilterPresets from "@/components/features/dashboard/components/FilterPresets";

<FilterPresets />;
```

| Prop      | Type                     | Default            | Purpose                                                      |
| --------- | ------------------------ | ------------------ | ------------------------------------------------------------ |
| `storage` | `Pick<Storage, "getItem" \| "setItem" \| "removeItem"> \| null` | `window.localStorage` | Injectable storage, used by tests and non-browser callers. |

The component is self-contained: it reads the active filter from the URL via
`useSearchParams()` and writes changes back with `router.replace()`, so it needs
no props to stay in sync with `TransactionFilters`.

## What a preset holds

A preset captures the full `TransactionFilter` shape from
[`lib/transactions/filters.ts`](../../../../lib/transactions/filters.ts) —
`type`, `status`, `asset`, `fromDate`, `toDate`, `search`:

```ts
interface FilterPreset {
  id: string;          // crypto.randomUUID(), with a timestamp+random fallback
  name: string;        // whitespace-normalised, unique case-insensitively
  filter: TransactionFilter;
  createdAt: string;   // ISO-8601
}
```

Values are read out of the URL with `parseTransactionFilter`, so a preset stores
exactly what the transactions API would accept (assets upper-cased, statuses
normalised). If the URL holds a value the validator rejects, the raw value is
kept instead so the preset still round-trips what the user was looking at.

## Persistence

Presets live under a **versioned** key:

```
stellarlend:transaction-filter-presets:v1
```

The payload is `{ version: 1, presets: FilterPreset[] }`. Reads go through
`parsePresets` → `migratePresetStore`, which never throws:

| Stored payload                      | Result                                        |
| ----------------------------------- | --------------------------------------------- |
| Valid `{ version, presets }`        | Used as-is                                    |
| Bare array (legacy, pre-versioning) | Migrated to the current version               |
| Unknown `version` number            | Rewritten to the current version              |
| Corrupt JSON, wrong type, `null`    | Treated as "no presets saved yet"             |
| Entries without a usable `name`     | Dropped                                       |
| Entries with duplicate id or name   | First one wins                                |
| Unknown keys inside `filter`        | Stripped, so they can never reach the URL     |

Bump the `v1` suffix (and `PRESETS_SCHEMA_VERSION`) only for a change
`migratePresetStore` cannot recover from; otherwise extend the migration.

### Storage-disabled (private mode) fallback

`isStorageAvailable` probes with a write/remove round-trip, and `savePresets`
returns `false` when a write is rejected (blocked storage, exceeded quota). In
that case the bar shows _"Browser storage is unavailable, so presets last only
for this session"_ and keeps working against in-memory state, so create, apply,
rename and delete still function until the page is reloaded.

Presets are loaded in an effect rather than during render, so the
server-rendered markup always matches the first client render.

## Applying a preset

`applyFilterToParams` rewrites the six preset-owned params on top of the current
query string, which means:

- unrelated params (e.g. `sort`) are preserved,
- filter params the preset does not define are cleared,
- `page` is dropped so the user lands on the first page of results.

The resulting URL is pushed with `router.replace(..., { scroll: false })`, so the
view stays shareable and the browser back button still works.

The preset whose filter equals the current URL filter is marked with
`aria-current="true"` and highlighted. Equality is order-independent
(`filterToQueryString` sorts the serialised params), so `?type=borrow&asset=XLM`
and `?asset=XLM&type=borrow` both match the same preset.

## Actions

| Action | UI                                        | Notes                                                                    |
| ------ | ----------------------------------------- | ------------------------------------------------------------------------ |
| Create | "Save current filters" → name field       | Requires a name **and** at least one active filter; rejects duplicates.  |
| Apply  | Click the preset chip                     | Updates the URL query params.                                            |
| Rename | Pencil button on the chip                 | Inline field; rejects duplicates (a preset may re-case its own name).     |
| Delete | Trash button on the chip                  | Removes the preset and persists immediately.                             |

Names are normalised with `normalizePresetName` (trimmed, inner whitespace
collapsed) before validation, so `" Borrows  30d "` and `"Borrows 30d"` collide.
Duplicate detection is case-insensitive.

## Accessibility

- The bar is a labelled `<section>` with an `<h2>` heading ("Saved filters").
- Presets are a `role="list"` (`aria-label="Saved filter presets"`) of list items.
- Every control is a real `<button>`, so it is reachable and operable by keyboard;
  icon-only buttons carry an `aria-label` naming their preset
  (e.g. "Delete preset Borrows"). Icons are `aria-hidden`.
- The create and rename fields submit on <kbd>Enter</kbd> and dismiss on
  <kbd>Escape</kbd>, and receive focus when their form opens.
- Validation errors render in a `role="alert"` region referenced by
  `aria-describedby`, with `aria-invalid` on the offending field.
- Applied/saved/renamed/deleted outcomes are announced through a polite
  `aria-live` region.

## Tests

```bash
# component
npm test -- FilterPresets
# helpers
npx vitest run --project accessibility lib/transactions/presets.test.ts
```

Both files are wired into the `accessibility` (jsdom) project in
`vitest.config.ts` and are at 100% statement/branch/function/line coverage.
Covered edge cases include corrupt storage payloads, legacy unversioned
payloads, duplicate names, an empty preset list, presets with no filters, and
the storage-disabled fallback.
