# StellarLend — Loading State Conventions

This document describes how route-level loading states and the global progress
indicator are implemented, and how to add them to new routes.

---

## Global Top Progress Bar

A thin green progress bar appears at the top of the viewport during every
client-side route transition. It is powered by
[`nextjs-toploader`](https://github.com/TheSGJ/nextjs-toploader) and mounted
once in `app/layout.tsx`.

```tsx
// app/layout.tsx (excerpt)
import NextTopLoader from "nextjs-toploader";

<NextTopLoader
  color="#15a350" // --color-primary
  height={3}
  showSpinner={false} // spinner disabled — loading.tsx handles per-route feedback
  shadow="0 0 10px #15a350, 0 0 5px #15a350"
  zIndex={9999}
/>;
```

**You do not need to touch this file when adding new routes.** The loader
triggers automatically on every `<Link>` navigation and `router.push()` call.

---

## Route-Level Loading Boundaries (`loading.tsx`)

Next.js App Router treats a `loading.tsx` file as a
[Suspense boundary](https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming)
that wraps the nearest `page.tsx` (and its nested layouts). It is shown
immediately while the page segment streams in from the server.

### When to add one

Add a `loading.tsx` whenever a route:

- Fetches data server-side (async Server Component or `fetch` in a layout/page)
- Has a noticeably heavy client bundle that takes time to hydrate
- Contains a form or interactive widget that should not flash in unstyled

### How to create one

1. Create `app/<your-route>/loading.tsx` alongside the route's `page.tsx`.
2. Export a **default Server Component** (no `"use client"` needed).
3. Mirror the real page's layout using skeleton blocks.

```tsx
// app/my-route/loading.tsx
export default function MyRouteLoading() {
  return (
    <div aria-busy="true" aria-label="Loading…">
      {/* Replicate the page's structural layout with skeleton blocks */}
      <div className="skeleton h-7 w-48" />
      <div className="skeleton h-4 w-72 mt-2" />
      {/* … */}
    </div>
  );
}
```

### Skeleton CSS classes

Two utility classes are defined in `app/globals.css`:

| Class             | Background         | Use for                                                |
| ----------------- | ------------------ | ------------------------------------------------------ |
| `.skeleton`       | Dark green shimmer | Pages with dark/green backgrounds (dashboard, lending) |
| `.skeleton-light` | Light gray shimmer | Pages with white/gray backgrounds (account, marketing) |

Both classes automatically **disable the shimmer animation** when the user has
`prefers-reduced-motion: reduce` set in their OS — the block becomes a static
muted color instead.

```css
/* globals.css — reduced-motion override (already in place) */
@media (prefers-reduced-motion: reduce) {
  .skeleton,
  .skeleton-light {
    animation: none;
  }
}
```

---

## Existing Loading Boundaries

| Route        | File                        | Background style          |
| ------------ | --------------------------- | ------------------------- |
| `/dashboard` | `app/dashboard/loading.tsx` | Dark green (`#15A350`)    |
| `/lending`   | `app/lending/loading.tsx`   | Gradient green → black    |
| `/account/*` | `app/account/loading.tsx`   | Light gray (`bg-gray-50`) |

---

## Accessibility Notes

- Every loading root element carries `aria-busy="true"` and a descriptive
  `aria-label` so screen readers announce the loading state.
- Skeleton blocks are purely decorative — they carry no text content and are
  not focusable, so they are invisible to assistive technology.
- The top progress bar (`nextjs-toploader`) renders a `role="progressbar"`
  element internally, satisfying WCAG 4.1.2.

---

## Fast-Transition Anti-Flicker

`nextjs-toploader` is configured with `initialPosition: 0.08` and
`crawlSpeed: 200 ms`. For navigations that resolve in under ~200 ms the bar
never reaches a visible position, preventing a flash for instant transitions.
The `loading.tsx` boundary is shown only when the server takes longer than
React's internal Suspense threshold (~50 ms), so fast cached navigations also
skip the skeleton entirely.
