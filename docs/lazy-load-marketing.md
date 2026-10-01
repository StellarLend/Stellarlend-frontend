# Lazy-load below-the-fold marketing sections

Testimonials and ExploreFeatures should load via `next/dynamic` with
`ssr: false` and a lightweight skeleton placeholder so first paint stays
under the dashboard bundle budget (see `bundlewatch.config.json`).

Recommended pattern:

```tsx
const Testimonials = dynamic(() => import('./Testimonials'), {
  loading: () => <SectionSkeleton />,
});
```

Place dynamic imports below the Hero fold only; keep critical CSS inlined.
