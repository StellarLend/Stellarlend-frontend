# Icon Button Accessibility — Enforced Audit Checklist

## Overview

This document describes the mandatory accessibility contract for every icon-only navigation control in the Stellarlend frontend.  
All new and existing icon-only controls **must** pass the checks below.

---

## Enforced Audit Checklist

Every icon-only nav control **MUST** satisfy **all** of the following:

| # | Check | Enforcement | Verified By |
|---|-------|-------------|-------------|
| 1 | **Accessible name** — `aria-label` is present and descriptive | TypeScript required prop on `IconButton`; code review for inline `<button>`s | Tests + TS |
| 2 | **Role** — element is a `<button>` (not a `<div>`) | JSX pattern enforcement | Tests |
| 3 | **`:focus-visible` ring** — `focus-visible:ring-2` with brand colour `#15A350` | Shared token `navClasses.iconButtonFocusClasses` | Tests |
| 4 | **Keyboard activation** — `Enter` / `Space` trigger the action | Built into `IconButton.handleKeyDown`; manual verification for raw buttons | Tests |
| 5 | **Disabled guard** — keyboard events do **not** fire when `disabled` or `loading` | `isDisabled` check in `handleKeyDown` | Tests |
| 6 | **`aria-expanded`** — present on collapse toggles that show/hide content | JSX attribute | Tests |
| 7 | **Design‑token reuse** — focus ring colour comes from `navTokens.focusRing` (`#15A350`) | Import via `navClasses.iconButtonFocusClasses` | Code review |

---

## Controls Covered

| Component | File | Status |
|-----------|------|--------|
| `IconButton` (atom) | `components/atoms/IconButton/IconButton.tsx` | Enforced |
| Notification bell (desktop) | `components/shared/layout/TopNav.tsx` | Enforced |
| Notification bell (mobile)  | `components/shared/layout/TopNav.tsx` | Enforced |
| Profile avatar              | `components/shared/layout/TopNav.tsx` | Enforced |
| `SidebarToggle`             | `components/shared/layout/TopNav.tsx` | Enforced |
| Sidebar collapse toggle (desktop) | `components/shared/layout/Sidebar.tsx` | Enforced |
| Mobile drawer trigger       | `components/shared/layout/Sidebar.tsx` | Enforced |
| Mobile drawer close button  | `components/shared/layout/Sidebar.tsx` | Enforced |

---

## Design Token Reference

The focus‑visible ring is defined in `constants/design-tokens.ts`:

```ts
export const navTokens = {
  focusRing: "#15A350",
  // …
};

export const navClasses = {
  iconButtonFocusClasses:
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15A350] focus-visible:ring-offset-2",
  // …
};
```

**Always** import and use `navClasses.iconButtonFocusClasses` instead of hard‑coding ring colours.

---

## Usage Guidelines

### Using the IconButton Component

```tsx
import { IconButton } from '@/components/atoms/IconButton';

// Basic usage with required aria-label
<IconButton 
  aria-label="Close dialog"
  onClick={handleClose}
>
  <XIcon />
</IconButton>

// With tooltip for discoverability
<Tooltip content="Settings">
  <IconButton 
    aria-label="Open settings"
    onClick={openSettings}
  >
    <SettingsIcon />
  </IconButton>
</Tooltip>

// Different sizes and variants
<IconButton 
  aria-label="Delete item"
  size="sm"
  variant="outline"
  onClick={deleteItem}
>
  <TrashIcon />
</IconButton>
```

### Accessibility Best Practices for Icon Buttons

1. **Always provide descriptive aria-labels**:
   - ✅ `aria-label="Close dialog"`
   - ❌ `aria-label="X"` or `aria-label="Icon"`

2. **Use semantic HTML**:
   - ✅ `<button>` for actions
   - ❌ `<div>` with click handlers

3. **Ensure visible focus states**:
   - Use `focus-visible:ring-2 focus-visible:ring-[#15A350] focus-visible:ring-offset-2`
   - Test with keyboard navigation

4. **Consider tooltips for discoverability**:
   - Helpful for icon-only buttons
   - Appears on hover and focus

5. **Test with screen readers**:
   - Verify button purpose is clear
   - Test keyboard navigation flow

## Testing

### Automated Tests

- **IconButton.test.tsx** — covers checks 1–6 from the checklist above:
  - Required `aria-label` presence (and compile-time guard)
  - Button role verification
  - Keyboard navigation (Enter, Space) in normal and disabled states
  - `focus-visible` ring class applied
  - Disabled / loading states
  - Size and variant variations

- **TopNav.test.tsx** — covers every icon-only nav control in the top bar:
  - `aria-label` on notification, profile, and sidebar-toggle buttons
  - `focus-visible` ring class on each icon-only button
  - Focusability check

- **Sidebar.test.tsx** — covers sidebar collapse toggle and mobile drawer:
  - `aria-label` and `aria-expanded` on collapse toggle
  - `focus-visible` ring class on toggle and drawer close button
  - Focusability check

### Manual Testing Checklist

- [ ] All icon buttons have descriptive `aria-label` attributes
- [ ] Focus‑visible rings are visible and use `#15A350` brand colour
- [ ] Keyboard navigation works (Tab, Enter, Space, Escape)
- [ ] Screen reader announces button purpose clearly
- [ ] Disabled buttons are properly disabled and announced
- [ ] Loading states are accessible
- [ ] `aria-expanded` is present and accurate on collapse toggles

## WCAG Compliance

This implementation addresses the following WCAG 2.1 AA requirements:

- **1.1.1 Non-text Content**: Icon buttons have text alternatives via `aria-label`
- **1.3.1 Info and Relationships**: Proper semantic HTML and ARIA attributes
- **2.1.1 Keyboard**: Full keyboard accessibility
- **2.4.3 Focus Order**: Logical focus management
- **2.4.7 Focus Visible**: Clear focus indicators using brand colour
- **4.1.2 Name, Role, Value**: Accessible names and roles for all controls

## Browser Support

All implemented features are supported in:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Focus‑visible ring styling uses modern CSS that's widely supported in current browsers.
