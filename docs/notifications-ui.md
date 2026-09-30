# Notifications UI

## Overview

The notifications feature provides a dropdown panel anchored to the NotificationBell in the header. It displays user notifications with full keyboard accessibility, grouping, and pinning support.

## Component Architecture

### NotificationBell

**Location:** `components/shared/layout/NotificationBell.tsx`

The bell trigger component that:
- Displays unread count badge (max 99+)
- Provides `aria-label` with unread count (singular/plural)
- Has `aria-expanded` and `aria-haspopup="dialog"` attributes
- Triggers panel open/close on click (Enter/Space handled by IconButton)

### NotificationCenter

**Location:** `components/shared/layout/NotificationCenter.tsx`

The dropdown panel component that:
- Renders notification list grouped by date (Today, Earlier this week, Older)
- Shows Pinned section for pinned notifications
- Supports collapsible date groups with `aria-expanded`
- Handles mark-as-read (individual and all) actions
- Implements focus trap with Tab/Shift+Tab cycling
- Closes on Escape key press
- Has `role="dialog"` and `aria-label="Notifications panel"`

## API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/notifications` | GET | Initial load of notification list |
| `/api/notifications/stream` | GET (SSE) | Live push of new notifications and unread count updates |
| `/api/notifications/[id]` | PATCH | Mark a single notification as read |
| `/api/notifications/read-all` | PATCH | Mark all unread notifications as read |

## Interaction Flow

```
User clicks bell → fetchNotifications() → panel opens → focus moves to first focusable element
  ↓
Panel renders with loading state → API response → notifications populated in groups
  ↓
User can: toggle groups, pin/unpin, mark read (individual/all)
  ↓
Panel closes via: Escape, click outside, or second bell click
  ↓
Focus returns to bell trigger
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Enter | Opens panel (IconButton handles) |
| Space | Opens panel (IconButton handles) |
| Escape | Closes panel and returns focus to bell |
| Tab | Moves focus to next focusable element inside panel |
| Shift+Tab | Moves focus to previous focusable element inside panel |

## Focus Management

1. **Opening:** When panel opens, `previouslyFocusedRef` stores the active element, then focus moves to the first focusable element in the panel.

2. **Focus Trap:** While panel is open:
   - Tab from last element cycles to first element
   - Shift+Tab from first element cycles to last element
   - Focus cannot escape to elements outside the panel

3. **Closing:** When panel closes:
   - Focus returns to the bell trigger element
   - Click-outside handler closes panel and restores focus

4. **Click Outside:** A `mousedown` event listener on `document` detects clicks outside both the bell and panel, closing the panel and restoring focus.

## Unread Badge Synchronization

- `useNotificationStream` provides real-time `unreadCount` from SSE stream
- Badge displays `unreadCount` (capped at 99+)
- When marking items read, local state updates immediately
- SSE stream continues to provide live count updates

## Testing Strategy

### Unit Tests

**Location:** `components/shared/layout/NotificationBell.grouping.test.tsx`

Tests cover:
- Panel open/close behavior
- Empty state rendering
- Group collapse/expand
- Mark all read functionality
- Individual mark as read
- Pin/unpin actions
- API error handling
- Click outside behavior
- Focus restoration on Escape

### Component Tests

**Location:** `components/shared/layout/NotificationCenter.test.tsx`

Tests cover:
- Rendering notifications
- Loading and empty states
- Mark as read buttons
- Mark all read visibility
- Keyboard accessibility (Escape, focus trap)
- Grouping and pinned sections
- Unread item styling

## Styling

- Panel: `bg-white`, `rounded-lg`, `shadow-lg`, `border-gray-200`
- Unread item background: `bg-blue-50/40`
- Read item background: `bg-white`
- Focus ring: `focus-visible:ring-2 focus-visible:ring-[#15A350]` (matches design tokens)

## Stream Contract

The notification system uses `lib/streams/notification-hub.ts` — an in-memory `EventEmitter` keyed by `notifications:${userId}`.

**Events:**

| Type          | Shape                                         |
| ------------- | --------------------------------------------- |
| `notification`| `{ type: 'notification', notification: any }` |
| `unreadCount` | `{ type: 'unreadCount', unreadCount: number }`|

**Guarantees:**

- Publish fan-outs to all subscribers of that user only (cross-user isolation).
- Each `subscribe()` returns an unsubscribe function that fully removes the listener.
- Listener count for a user key returns to zero after all subscribers unsubscribe.
- Double-unsubscribe is safe (no-op).
- Publishing with no subscribers is a no-op (does not throw).