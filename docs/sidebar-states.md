# Sidebar States

The sidebar now supports three responsive states driven by `SidebarContext`:

- **Expanded desktop**: full navigation with icon + labels.
- **Collapsed desktop rail**: narrow icon-only rail with clear active indicator and accessible labels.
- **Mobile drawer**: full-screen slide-in drawer with overlay, focus trapping, and body scroll lock.

## Accessibility

- The mobile drawer uses `role="dialog"`, `aria-modal="true"`, and a close button.
- Focus is trapped inside the drawer while open, and `Escape` closes it.
- Active route styling remains visible in both expanded and collapsed states, including route-aware styling for dashboard navigation.
- The collapsed rail preserves label text via `aria-label` and `sr-only` text.

## UX details

- Desktop collapse is controlled by the sidebar toggle in the top navigation.
- Mobile opens as an overlay drawer, hiding page scroll while active.
- Reduced-motion preferences are respected for animation transitions.
