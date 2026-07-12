# Dashboard layout regions

`DashboardLayout` composes `SideNav`, `TopNav`, and a `<main>` landmark for
dashboard children. RTL tests live in `components/shared/layout/DashboardLayout.test.tsx`.

Responsive behaviour: side navigation collapses on narrow viewports; main content
scrolls independently of the green background shell.
