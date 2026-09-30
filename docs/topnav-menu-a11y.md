# TopNav Account Menu Accessibility

The TopNav connected-wallet trigger opens a small account action menu. The menu follows these keyboard and screen-reader contracts:

- The trigger exposes `aria-haspopup="menu"` and updates `aria-expanded` while the menu is open.
- The open menu is labelled as "Connected wallet actions" and uses `role="menu"`.
- Menu actions use `role="menuitem"`.
- Focus moves to the menu container first so the destructive Disconnect Wallet action is not the default focus target.
- `Tab` and `Shift+Tab` stay inside the open menu.
- `Escape` closes the menu and returns focus to the connected-wallet trigger.
- Clicking outside the menu closes it and restores the collapsed ARIA state.

Keep future account actions inside the same menu container so the focus trap can include them automatically.
