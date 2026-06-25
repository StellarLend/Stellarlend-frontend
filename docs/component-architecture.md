# Component Architecture

This guide defines where new React components belong and which layers may depend on each other. It is the living reference for contributors adding or moving components under `components/`.

## Layer Responsibilities

### Atoms

`components/atoms/` contains the smallest reusable UI primitives. Atoms should be generic, presentational, and free of product-specific business logic.

Example: `components/atoms/Button/Button.tsx` and `components/atoms/IconButton/IconButton.tsx` are button-level primitives that can be reused by higher layers.

Allowed imports:

- React and framework/library dependencies
- Local atom files such as types, tests, and stories
- Shared utilities from non-component infrastructure, such as `lib/`, `utils/`, `constants/`, or `types/`

Atoms must not import molecules, organisms, feature components, marketing components, app routes, or shared layout/common components.

### Molecules

`components/molecules/` contains small composed controls built from atoms or generic utilities. Molecules should still be reusable outside any single business feature.

Example: `components/molecules/SearchBar/SearchBar.tsx` composes input/search behavior as a reusable control.

Allowed imports:

- Atoms
- Shared UI primitives
- Non-component utilities from `lib/`, `utils/`, `constants/`, or `types/`

Molecules must not import organisms, feature components, app routes, or feature-specific services.

### Organisms

`components/organisms/` contains larger reusable page sections assembled from atoms, molecules, and shared primitives. Organisms can coordinate layout and multiple controls, but they should not own feature-specific data flows.

Example: `components/organisms/Header/Header.tsx` is a reusable navigation/header section rather than a lending, dashboard, or account feature.

Allowed imports:

- Atoms
- Molecules
- Shared UI, common, and layout components
- Non-component utilities from `lib/`, `utils/`, `constants/`, or `types/`

Organisms must not import feature internals from `components/features/*` or app routes.

### Feature Components

`components/features/` contains business-domain components organized by feature. Feature components may contain product-specific UI flows and connect shared primitives to feature logic.

Current feature folders:

- `components/features/lending/` for lending and borrowing workflows, such as `LendingForm.tsx`.
- `components/features/dashboard/` for dashboard-specific surfaces, such as `MetricsCards.tsx`.
- `components/features/account/` for account/profile UI, such as `ProfileForm.tsx`.

Allowed imports:

- Atoms, molecules, and organisms
- Shared UI, common, and layout components
- Feature-local hooks, services, types, and components from the same feature folder
- Non-component utilities from `lib/`, `utils/`, `constants/`, or `types/`

Feature components may use shared layers, but shared layers must not import feature components. Avoid importing another feature's internal files directly; expose a shared component or utility instead when reuse is needed.

### Shared Components

`components/shared/` contains reusable components that are not tied to a single business feature.

Current shared folders:

- `components/shared/ui/` for low-level reusable UI elements such as `Button.tsx`.
- `components/shared/common/` for reusable application-level widgets such as `Searchbar.tsx` and `RecentTransactions.tsx`.
- `components/shared/layout/` for layout and navigation primitives such as `DashboardLayout.tsx`, `Navbar.tsx`, and `Sidebar.tsx`.

Allowed imports:

- Atoms and molecules when a shared component needs generic primitives
- Other shared components from the same or lower-level shared folder
- Non-component utilities from `lib/`, `utils/`, `constants/`, or `types/`

Shared components must not import feature components or app routes. If a shared component needs feature behavior, keep the shared component presentational and pass the feature behavior through props.

### Marketing Components

`components/marketing/` contains landing-page and campaign-facing sections, such as `Hero.tsx`, `HowItWorks.tsx`, and `Footer.tsx`.

Allowed imports:

- Atoms, molecules, and organisms
- Shared UI and layout components
- Marketing-local assets and utilities

Marketing components should not import feature internals. If marketing pages need live product data, add a small explicit integration at the page or feature boundary instead of coupling marketing sections to feature components.

## Import Direction

Use this dependency direction when adding or moving components:

```text
app routes
  -> features and marketing
  -> organisms
  -> molecules
  -> atoms
  -> non-component utilities

features
  -> shared
  -> atoms/molecules/organisms
  -> non-component utilities

shared
  -> atoms/molecules
  -> non-component utilities
```

The rule is one-way: lower-level and shared layers must not reach upward into feature-specific, marketing-specific, or route-specific code.

## Current Folder Map

| Folder | Layer | Notes |
| --- | --- | --- |
| `components/atoms/` | Atoms | Generic primitives such as `Button`, `IconButton`, `Tooltip`, and `ScrollCues`. |
| `components/molecules/` | Molecules | Reusable composed controls such as `SearchBar`. |
| `components/organisms/` | Organisms | Reusable page sections such as `Header`. |
| `components/features/` | Feature components | Domain-specific component trees for lending, dashboard, and account. |
| `components/shared/ui/` | Shared UI | Reusable low-level UI currently including `Button`. |
| `components/shared/common/` | Shared common | Cross-feature widgets such as `Searchbar` and `RecentTransactions`. |
| `components/shared/layout/` | Shared layout | Navigation and layout components such as `Navbar`, `Sidebar`, and `DashboardLayout`. |
| `components/marketing/` | Marketing | Landing-page sections and marketing content. |
| `components/Button/` | Legacy top-level component folder | Keep stable until migrated or removed; do not add new components here. |
| `components/Input/`, `components/Modal/`, `components/NavLink/`, `components/Pagination/` | Legacy top-level component folders | Treat as migration debt; prefer the documented layers for new work. |

## Known Component Debt

Two duplicated component families still exist and should be handled deliberately in future cleanup work:

- `Button`: found in `components/atoms/Button/`, `components/shared/ui/Button.tsx`, and the legacy top-level `components/Button/` folder.
- `SearchBar`/`Searchbar`: found in `components/molecules/SearchBar/` and `components/shared/common/Searchbar.tsx`.

Do not introduce another implementation with the same responsibility. When touching one of these areas, prefer migrating callers toward the intended shared primitive, then remove the duplicate only after import paths, stories, and tests are updated.

## Placement Checklist

Before creating a component, choose the lowest layer that can own it:

- If it is a generic primitive, place it in `components/atoms/` or `components/shared/ui/`.
- If it combines primitives into a reusable control, place it in `components/molecules/`.
- If it is a reusable page section, place it in `components/organisms/`.
- If it is tied to lending, dashboard, account, or another business workflow, place it under `components/features/<feature>/components/`.
- If it is reusable layout/navigation, place it under `components/shared/layout/`.
- If it is a reusable cross-feature widget, place it under `components/shared/common/`.
- If it is landing-page or campaign-specific, place it under `components/marketing/`.

When the placement is unclear, keep the component feature-local first. Promote it into `shared`, `molecules`, or `organisms` only after a second real caller needs the same behavior.
