# SidebarContext Test Plan

## Overview

Unit test suite for `context/SidebarContext.tsx` — the React Context provider managing sidebar open/close state, mobile detection, and `localStorage` persistence.

**Coverage:** 100% statements, 100% functions, 100% lines, 95.23% branches.  
The only uncovered branch is `typeof window === "undefined"` (SSR guard), untestable in jsdom.

**Test file:** `context/SidebarContext.test.tsx`

---

## Test Structure

```
SidebarContext (24 tests)
├── Provider defaults (2)
│   ├── default isSidebarOpen = true
│   └── default isMobile = false
├── Actions (3)
│   ├── toggleSidebar flips true→false→true
│   ├── closeSidebar sets false
│   └── stable function references across renders (useCallback)
├── Out-of-provider error guard (1)
│   └── useSidebar() outside SidebarProvider throws
├── Multiple consumers in sync (1)
│   └── two consumers share state; toggle updates both
├── Initial state overrides (4)
│   ├── initialSidebarOpen overrides default
│   ├── initialSidebarOpen=true keeps sidebar open
│   ├── initialIsMobile as initial value
│   └── mobile viewport overrides initialIsMobile
├── localStorage — read on mount (3)
│   ├── reads collapsed (true) → sidebar closed
│   ├── reads not-collapsed (false) → sidebar open
│   └── initialSidebarOpen skips localStorage read
├── localStorage — write on toggle/close (4)
│   ├── toggle persists collapsed=true
│   ├── second toggle persists collapsed=false
│   ├── closeSidebar persists collapsed=true
│   └── initialSidebarOpen skips persistence
├── localStorage error handling (3)
│   ├── setItem error in toggleSidebar
│   ├── setItem error in closeSidebar
│   └── getItem error in checkDimensions
└── Mobile behavior (3)
    ├── detects mobile on mount (<768px)
    ├── resize below 768px triggers mobile
    └── resize above 768px reverts mobile
```

---

## Key Behaviors Tested

| Behavior | Storage Key | Logic |
|---|---|---|
| Persistence key | `stellarlend_sidebar_v1:collapsed` | Versioned to avoid collisions |
| Read on mount | `getItem(key)` → `savedState !== "true"` | Stores "collapsed" state, open is inverse |
| Desktop toggle | `setItem(key, (!nextState).toString())` | Invert: open → "false", closed → "true" |
| Desktop closeSidebar | `setItem(key, "true")` | Always stores "collapsed" |
| Suppression | Skipped when `initialSidebarOpen` provided | Effect also skips localStorage read |
| Mobile | `< 768px` forces `isSidebarOpen = false` | Effect also closes sidebar on resize |

## Running Tests

```bash
npm test -- SidebarContext
npx vitest run --coverage
```
