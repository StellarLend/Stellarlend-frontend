# Marketing accessibility audit

Hero and HowItWorks sections should meet WCAG 2.2 AA contrast targets in both
light and dark themes. Checklist for contributors:

- Text/background pairs ≥ 4.5:1 (normal) or 3:1 (large type)
- Focus rings visible on interactive controls
- `prefers-reduced-motion` disables non-essential animations
- Decorative images use empty `alt` text; informative images have concise labels

Run `npm run test -- test/server/security-headers.test.ts` for baseline
security header coverage on API routes consumed by marketing forms.
