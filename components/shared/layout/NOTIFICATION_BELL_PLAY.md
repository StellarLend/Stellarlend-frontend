# NotificationBell Play Tests

This document describes the Storybook interaction (play) test scenarios for the
`NotificationBell` widget — the bell trigger plus its dropdown notification panel.

## Motivation

The `NotificationBell` unit tests (`NotificationBell.test.tsx`) cover badge
rendering (count visibility, pluralisation, 99+ cap). They do **not** exercise
the user's full journey through the notification widget: opening the panel,
marking items read, or the keyboard Escape → focus-restore loop.

The play tests below fill that gap by running inside Storybook's browser-like
environment via `@storybook/addon-vitest` and `@storybook/test`.

## Test scenarios

### 1. Open panel via mouse click

- **Story:** `Play: Open panel via click`
- **Assertions:**
  1. `aria-expanded` is `"false"` initially.
  2. Clicking the trigger opens the panel (verified by `data-testid="notification-panel"`).
  3. `aria-expanded` becomes `"true"`.

### 2. Open panel via keyboard (Enter)

- **Story:** `Play: Open panel via keyboard (Enter)`
- **Assertions:**
  1. The trigger is focused programmatically.
  2. Pressing `Enter` opens the panel.
  3. `aria-expanded` becomes `"true"`.

### 3. Mark as read updates the unread badge

- **Story:** `Play: Mark as read updates badge`
- **Assertions:**
  1. Trigger label reads `"3 unread notifications"` and badge shows `"3"`.
  2. After clicking the first "Mark as read" button, badge updates to `"2"`.
  3. Trigger `aria-label` reflects the new count (`"2 unread notifications"`).

### 4. Escape closes panel and restores focus

- **Story:** `Play: Escape closes panel and restores focus`
- **Assertions:**
  1. Panel is opened via click.
  2. Pressing `Escape` removes the panel from the DOM.
  3. Focus returns to the trigger button.
  4. `aria-expanded` returns to `"false"`.

### 5. Empty notifications state

- **Story:** `Play: Empty notifications state`
- **Assertions:**
  1. No unread badge is rendered (`"No unread notifications"` label).
  2. Clicking the trigger opens the panel.
  3. The panel shows a "No notifications yet" empty-state message.

## Running the tests

```bash
# Visual inspection in the browser
pnpm storybook

# CI / headless via Vitest + @storybook/addon-vitest
pnpm test
```

## Implementation notes

- The play stories use a `NotificationWidget` wrapper (defined inside
  `NotificationBell.stories.tsx`) that composes a bell trigger with a dropdown
  notification panel. This avoids coupling to the real
  `useNotificationStream` SSE hook while still exercising the exact UI
  contract (badge, aria-labels, keyboard handling, focus management).
- The wrapper manages its own `unreadCount` state so that **Mark as read**
  can decrement it deterministically without a real server or SSE mock.
- Focus is restored to the trigger on `Escape` via a `useRef` + `.focus()`
  call after closing the panel.
- Stories use `data-testid` attributes for panel and notification element
  queries; `aria-label` matchers for trigger queries.
