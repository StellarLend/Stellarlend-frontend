DashboardLayout Test Plan
Overview
`components/shared/layout/DashboardLayout.tsx` orchestrates the three primary
layout regions — sidebar (`SideNav`), top navigation (`TopNav`), and the main
content slot — but had no test coverage. This document records the test plan,
test groupings, rationale, and edge cases covered by
`DashboardLayout.test.tsx`.
---
Component Under Test
```
components/shared/layout/DashboardLayout.tsx
```
What it does:
Renders a skip-to-content anchor as the first focusable DOM element.
Wraps `SideNav` (which contains the `<nav>` landmark).
Wraps `TopNav` in a `<header>` landmark.
Renders `children` inside a `<main id="main-content">` landmark.
Composes with `SidebarContext` — `SideNav` reads `isSidebarOpen` and
`isMobile` from the context to decide between expanded, collapsed-rail, and
mobile-drawer states.
---
Changes Made to the Component
The original `DashboardLayout.tsx` was missing three accessibility requirements:
Missing feature	Change made
No skip-to-content link	Added `<a href="#main-content">Skip to main content</a>` as the first DOM node
No `<header>` landmark	Wrapped `<TopNav />` in `<header>`
No `id` on `<main>`	Added `id="main-content"` to the `<main>` element
No layout, styling, or behavioural logic was changed.
---
Mocks
All external dependencies are mocked so tests are deterministic and do not
require network, router, or file-system access:
Mock	Reason
`next/navigation`	`WalletContext` (pulled in via `TopNav`) calls `useRouter`
`next/image`	Avoids the Next.js image pipeline in JSDOM
`NotificationBell`	Renders a lightweight button stub; avoids real async fetch
`NavigationMenu`	Renders a `<nav>` with `data-collapsed` attribute for assertion
`fetch` (global)	Prevents `WalletContext` session rehydration from hitting the network
---
Test Groups
1. Landmark regions
Goal: Assert that `header`, `nav`, and `main` landmarks are present and
correctly placed in the DOM.
Test	What it asserts
Renders a header landmark	`document.querySelector("header")` is not null
TopNav is inside the header	Search input (TopNav anchor) is in the document
Nav landmark present	`getByRole("navigation", { name: /primary navigation/i })` found
Nav landmark has links	At least one `<a>` is inside the nav
Main landmark present	`getByRole("main")` found
Main has `flex-1` class	Full-height slot class is preserved
---
2. Children slot composition
Goal: Verify that anything passed as `children` renders inside `<main>`.
Test	What it asserts
Text children render	Text content visible in document
Children inside `<main>`	`main` contains the child element
Multiple children render	All three sibling nodes visible
Deeply nested children	Nested `data-testid` reachable via `screen.getByTestId`
No children — main present	`<main>` exists and `toBeEmptyDOMElement()`
Null children — main present	`<main>` exists
---
3. Skip-to-content
Goal: Confirm the skip link exists, targets the correct anchor, and is the
first focusable element.
Test	What it asserts
Skip link renders	`getByRole("link", { name: /skip to (main )?content/i })` found
Skip link `href`	`href="#main-content"`
`<main>` has `id="main-content"`	Skip link target resolves
Skip link is first focusable	`document.querySelectorAll(focusable)[0]` is the skip link
---
4. SidebarContext — expanded sidebar
Goal: Assert layout behaviour when `initialSidebarOpen=true` and
`initialIsMobile=false`.
Test	What it asserts
Desktop aside renders	Navigation menu is in the document
NavigationMenu receives `isCollapsed=false`	`data-collapsed="false"` attribute
Flex wrapper present	Outer div has `class="flex"`
---
5. SidebarContext — collapsed sidebar
Goal: Assert layout behaviour when `initialSidebarOpen=false` and
`initialIsMobile=false` (collapsed rail).
Test	What it asserts
NavigationMenu receives `isCollapsed=true`	`data-collapsed="true"` attribute
Main slot accessible	`<main>` contains the child element
Nav landmark still rendered	Navigation present in collapsed state
Main landmark still rendered	`<main>` present in collapsed state
---
6. Mobile viewport
Goal: Assert layout renders correctly when `initialIsMobile=true`.
Test	What it asserts
Main landmark renders on mobile	`getByRole("main")` found
Children render on mobile	`data-testid` child inside `<main>`
Desktop aside absent	No `<aside role="complementary">` present
---
7. Layout composition
Goal: Assert DOM structure and ordering of regions.
Test	What it asserts
Outer wrapper has `flex`	`container.firstChild` has class `flex`
Content column is `w-full min-h-screen`	Parent of `<main>` has both classes
Main is direct child of content column	`contentColumn.querySelector("main") === main`
DOM order: nav → header → main	`compareDocumentPosition` assertions
---
8. Missing optional slots (edge cases)
Goal: Confirm the layout degrades gracefully when optional content is absent.
Test	What it asserts
`children=undefined` does not throw	`expect(() => renderLayout(undefined)).not.toThrow()`
`children=null` does not throw	Same pattern
`children=<></>` does not throw	Same pattern
`<main>` always present	Exists even with no children
All landmarks always present	nav + main present regardless of children
---
Running the Tests
```bash
# Run only DashboardLayout tests
npm test -- DashboardLayout

# With coverage
npm test -- DashboardLayout --coverage

# Watch mode during development
npm test -- DashboardLayout --watch
```
---
Coverage Targets
Metric	Target
Lines	≥ 95 %
Functions	≥ 95 %
Branches	≥ 90 %
Statements	≥ 95 %
All branches in `DashboardLayout.tsx` are covered:
`children` present → children render in `<main>`.
`children` absent (`undefined`, `null`, empty fragment) → `<main>` renders empty.
Sidebar expanded (default).
Sidebar collapsed (`initialSidebarOpen=false`).
Mobile viewport (`initialIsMobile=true`).
---
Files
File	Purpose
`components/shared/layout/DashboardLayout.tsx`	Component — skip link, header landmark, and main id added
`components/shared/layout/DashboardLayout.test.tsx`	RTL test suite (this document's test plan)
`components/shared/layout/DASHBOARD_LAYOUT_TESTS.md`	This document
