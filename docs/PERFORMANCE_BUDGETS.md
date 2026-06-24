# Performance Budget: Token Icons

Token icons are lazy-loaded via `React.lazy` + dynamic import in `components/shared/ui/icons/TokenIcon.tsx`. Only the icons actually rendered in the current view are loaded — the rest stay in their own chunks.

**Before:** All token icons were bundled into the lending route chunk.
**After:** Each icon is a separate chunk loaded on-demand. The initial bundle ships only the placeholder (a 200-byte div), and the icon SVG loads asynchronously.

---

# Performance Budget: Lending Route

To maintain fast initial load times for the lending page, we have implemented code splitting using `next/dynamic`.

## Budget

The lending route chunk is budgeted at **150kb**. 

- This ensures that only the essential code for the landing state (Lending tab) is loaded initially.
- The `BorrowingForm`, `InterestCalculator`, and `ConfirmModal` are loaded lazily on demand.

## How to maintain this budget

If you add new functionality to the lending page:

1. **Lazy Load:** If the new component is not needed for the initial render (e.g., modals, form variants for off-screen tabs), lazy-load it using `next/dynamic`.
2. **Review Imports:** Ensure large libraries or heavy utility functions are not bundled into the main `page.tsx` chunk unnecessarily.
3. **Check CI:** The `bundlewatch` CI check will automatically fail if the budget is exceeded.
4. **Update Budget:** If the budget is legitimately exceeded due to unavoidable new feature requirements, update the `maxSize` in `bundlewatch.config.json` and document the reason for the increase in this file.
