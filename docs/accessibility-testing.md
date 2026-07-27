# Accessibility Testing & Guidelines

This document outlines the accessibility (a11y) standards, policies, and manual/automated testing procedures for the Stellarlend-frontend application.

---

## 1. Motion and Animations Policy

To provide an optimal and non-distracting user experience for all users, including those with vestibular disorders or motion sensitivity:

- **prefers-reduced-motion**: All custom components that feature transitions, animations, or state-based scaling must respect the user's motion preferences.
- **Shared Hook**: Use the custom hook `useReducedMotion` from `@/hooks/useReducedMotion` to conditionally disable CSS transitions and animations in React components.
- **Tailwind conditional usage**:
  ```tsx
  const shouldReduceMotion = useReducedMotion();
  
  return (
    <div className={`transition-all ${shouldReduceMotion ? '' : 'hover:scale-105'}`}>
      ...
    </div>
  );
  ```

### Covered Components
- **AlertBanner**: Dismiss button transitions are disabled when reduced motion is preferred.
- **PositionSummary**: Loading skeleton `animate-pulse` animations and hover transitions are disabled when reduced motion is preferred.
- **MetricsCards**: Card scaling and transform effects on hover are disabled when reduced motion is preferred.

---

## 2. Interactive Components and Keyboard Navigation

All complex widgets (e.g. selectors, dropdowns, menus) must be fully operable by keyboard.

### AssetSelector Component
- **Trigger**: Focusable via Tab, opens dropdown via `Enter`, `Space`, or `ArrowDown`.
- **Keyboard Navigation**:
  - `ArrowDown` / `ArrowUp` navigates through the filtered assets list.
  - `Enter` selects the highlighted asset.
  - `Escape` closes the dropdown and returns focus to the trigger.
- **Search Filtering**: Filter input gets auto-focused when dropdown opens, allowing quick type-to-search without manual navigation.
- **Screen Reader Announcements**: Uses a live region (`aria-live="polite"`) to announce the number of search results found and selection updates to screen readers.
- **ARIA attributes**: Adheres to the W3C WAI-ARIA Combobox design pattern using `role="combobox"`, `role="listbox"`, and `role="option"` with `aria-selected` tracking active selection.
