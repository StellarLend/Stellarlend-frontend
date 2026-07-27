# Page Surface Conventions

This project uses a simple rule for content-heavy routes:

- Keep decorative brand gradients as accents, not the backdrop for readable text.
- Put page titles, descriptions, and actions on an opaque or near-opaque surface.
- Use `PageHeader tone="light"` when the surrounding surface is white or very light.
- Keep form cards, calculators, and summaries on the same surface family so the page feels cohesive.

## Lending Route Pattern

The `/lending` route is the reference implementation for this convention:

- The outer page uses a light canvas (`bg-slate-50`).
- The brand gradient is limited to a top accent band and ambient blur shapes.
- The route header sits on a dedicated white card with light-tone header text.
- The body content keeps its existing white cards, so the text contrast stays WCAG AA compliant.

## Accessibility Checklist

- Verify titles and body copy maintain at least 4.5:1 contrast against their surface.
- Confirm decorative gradient layers are marked `aria-hidden` and do not intercept pointer events.
- Run the route-level accessibility test before merging changes that touch page shells or header tones.
