# Borrow with Collateral E2E Test Scenario

This end-to-end test covers the complete user journey for borrowing assets against collateral on StellarLend.

## Scenario Breakdown

### 1. Pre-requisites & Setup
* **Wallet Connection**: Verified via the `TopNav` component containing the mock-connected wallet address (`Ga2j6...f5g3`).
* **API Stubbing**:
  * `/api/markets?asset=XLM` is stubbed to return mock market APRs.
  * `/api/prices?assets=*` is stubbed to return fixed deterministic prices (e.g. XLM = $0.12, USDC = $1.00).

### 2. Happy Path: Successful Borrow Journey
1. Navigate to `/lending`.
2. Switch from "Lend" to the "Borrow" tab.
3. Select **USDC** as the borrow asset.
4. Enter a borrow amount of **100**.
5. Select **XLM** as the collateral asset.
6. Verify the required collateral auto-populates to **150.00 XLM** (150% minimum).
7. Verify the projected health preview is initially **Critical** (value = `0.15x`).
8. Fill in **3000** for the collateral amount.
9. Verify the projected health factor updates to **Healthy** (value = `3.00x`).
10. Choose **1 Month** loan duration.
11. Click **Review Loan Request**.
12. Verify the confirmation modal details (shows `100.00 USDC` borrow and `3,000.00 XLM` collateral).
13. Agree to the terms and click **Confirm Borrowing**.
14. Verify the toast notification transitions through "Transaction submitted" and "Completed".

### 3. Edge Case: Insufficient Collateral / Validation Errors
* **Below 150%**: Attempting to borrow with collateral below 150% (e.g. 50 XLM for 100 USDC borrow) displays "Collateral must meet the 150% minimum".
* **Over Balance**: Attempting to supply more collateral than the wallet balance (e.g. 5000 XLM when balance is 3750 XLM) displays "Insufficient collateral balance".

### 4. Edge Case: Back-Navigation / Cancel Mid-flow
* Open the confirmation modal and click **Cancel**.
* Verify that the modal is dismissed and all inputs remain intact in the form.

### 5. Edge Case: Network/Submission Error
* Stub `/api/tx/submit` to return a `500` status code.
* Confirm the transaction in the modal.
* Verify that the UI displays a "Submission failed" toast.

## Running the Tests

To run the end-to-end tests:

```bash
# Run all E2E tests
npx playwright test

# Run only the borrow-collateral spec
npx playwright test test/e2e/borrow-collateral.spec.ts
```
