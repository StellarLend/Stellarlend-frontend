# Borrowing leverage what-if slider

BorrowingForm should project health factor and liquidation price as the user
adjusts a leverage slider. Derive previews from `lib/lending/health` using live
collateral factors from `lib/markets/registry`.

Show warnings when projected health drops below 1.2 and block submit below 1.0.
