# Playwright markets journey (planned)

End-to-end coverage target:

1. Browse `/markets` and assert asset cards render APR/utilisation
2. Open an asset detail page and verify chart + CTA links
3. Confirm wallet connect stub does not block read-only browsing

Spec location (to add): `e2e/markets-browse.spec.ts`. Run via `npm run test:e2e`
once the Playwright harness lands on `main`.
