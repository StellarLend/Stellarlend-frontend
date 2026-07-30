# DashboardLayout regions

How the authenticated shell is composed.

Source: [`components/shared/layout/DashboardLayout.tsx`](../components/shared/layout/DashboardLayout.tsx)

Tests:

- Composition / landmarks: [`DashboardLayout.test.tsx`](../components/shared/layout/DashboardLayout.test.tsx)
- Error isolation: [`DashboardLayout.error-boundary.test.tsx`](../components/shared/layout/DashboardLayout.error-boundary.test.tsx)

## Regions

```
┌──────────┬────────────────────────────┐
│          │  header (TopNav)           │
│ SideNav  ├────────────────────────────┤
│ (nav)    │  main#main-content         │
│          │    {children}              │
└──────────┴────────────────────────────┘
```

| Region   | Element                         | Role / landmark        | Failure mode                          |
| -------- | ------------------------------- | ---------------------- | ------------------------------------- |
| Skip     | `<a href="#main-content">`      | link                   | Always present; `sr-only` until focus |
| Sidebar  | `<SideNav />`                   | navigation (in SideNav)| `sidenav-fallback` via error boundary |
| Header   | `<header><TopNav /></header>`   | banner                 | `topnav-fallback` via error boundary  |
| Content  | `<main id="main-content">`      | main                   | Always mounts; children optional      |

## Skip link

The first focusable control is "Skip to main content". It targets
`#main-content` so keyboard users bypass the sidebar and top nav.

## Error isolation

`SideNav` and `TopNav` each sit inside a `LayoutRegionBoundary`. If either
throws during render the rest of the shell stays up — the main content region
is never unmounted by a chrome failure. See the error-boundary tests.

## Collapsed / expanded rail

The layout shell itself does not own collapsed-rail state. Rail expansion is
owned by `SideNav` / its context. Composition tests assert the sidebar *slot*
is present; rail width behaviour is covered by SideNav's own suite.

## Empty children

`DashboardLayout` accepts any `ReactNode`. Passing `null` / `undefined` still
renders the chrome and an empty `<main>` — useful for loading routes that
suspend their body.
