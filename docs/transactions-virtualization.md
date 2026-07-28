# Transactions table virtualization

The transactions history table now uses a lightweight virtualization layer when the visible dataset grows large. Only the rows that are near the current scroll window are mounted, which keeps the DOM smaller and improves scroll performance for large histories.

## What changed
- Virtualized the desktop transactions table body while keeping the existing table structure intact.
- Preserved keyboard navigation with ArrowUp/ArrowDown, Home, and End.
- Kept `aria-rowcount` and `aria-rowindex` semantics aligned with the rendered row window.
- Left small datasets unvirtualized so the experience remains unchanged for typical histories.

## Notes
- The virtualization threshold is intentionally conservative to avoid unnecessary complexity on small lists.
- The table remains compatible with the dashboard's existing loading and pagination flow.
