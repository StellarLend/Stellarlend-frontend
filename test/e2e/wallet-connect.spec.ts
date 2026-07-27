import { test, expect } from '@playwright/test';
import { Keypair, TransactionBuilder, Networks } from '@stellar/stellar-sdk';

// Generate a mock client keypair for E2E tests
const mockClientKeypair = Keypair.random();
const mockClientPublicKey = mockClientKeypair.publicKey();

// Extend Window interface for the test browser context
declare global {
  interface Window {
    stellar?: {
      getPublicKey: () => Promise<string>;
      signTransaction: (xdr: string, opts?: { network: string }) => Promise<string>;
    };
    mockSignTransaction: (xdr: string) => Promise<string>;
  }
}

test.describe('Wallet Connection E2E', () => {
  test.beforeEach(async ({ page, context }) => {
    // Clear cookies before each test to start with a clean state
    await context.clearCookies();

    // Pipe browser console logs and exceptions to test stdout
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER EXCEPTION:', err.message));

    // Expose a secure signing function to the browser page.
    // This executes in the Node.js test environment and has access to mockClientKeypair.
    await page.exposeFunction('mockSignTransaction', async (xdr: string) => {
      try {
        console.log('E2E mockSignTransaction - client PK:', mockClientPublicKey);
        console.log('E2E mockSignTransaction - incoming XDR:', xdr);
        const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
        tx.sign(mockClientKeypair);
        const signedXdr = tx.toXDR();
        console.log('E2E mockSignTransaction - signed XDR:', signedXdr);
        return signedXdr;
      } catch (err: any) {
        console.error('E2E mockSignTransaction - error:', err);
        throw new Error(`Exposed mock sign failure: ${err.message}`);
      }
    });

    // Inject a standard mock window.stellar wallet provider
    await page.addInitScript(({ publicKey }) => {
      window.stellar = {
        getPublicKey: async () => {
          // If a custom override is set on window, use it (for error scenarios)
          if ((window as any).__mockGetPublicKeyError) {
            throw new Error((window as any).__mockGetPublicKeyError);
          }
          return publicKey;
        },
        signTransaction: async (xdr) => {
          if ((window as any).__mockSignTransactionError) {
            throw new Error((window as any).__mockSignTransactionError);
          }
          return window.mockSignTransaction(xdr);
        }
      };
    }, { publicKey: mockClientPublicKey });
  });

  const getShortAddress = (addr: string) => {
    return `${addr.slice(0, 5)}...${addr.slice(-4)}`;
  };

  test('should display Connect Wallet button initially', async ({ page }) => {
    await page.goto('/');
    const connectBtn = page.getByRole('button', { name: /Connect Wallet/i });
    await expect(connectBtn).toBeVisible();
  });

  test('should connect wallet successfully, display shortened address, and set session', async ({ page }) => {
    await page.goto('/');
    const connectBtn = page.getByRole('button', { name: /Connect Wallet/i });
    await connectBtn.click();

    // Verify button changes to shortened address
    const expectedLabel = getShortAddress(mockClientPublicKey);
    const connectedBtn = page.getByRole('button', { name: /Connected wallet/i });
    await expect(connectedBtn).toBeVisible();
    await expect(connectedBtn.locator('span').first()).toHaveText(expectedLabel);
  });

  test('should persist wallet connection state across page reloads', async ({ page }) => {
    await page.goto('/');
    const connectBtn = page.getByRole('button', { name: /Connect Wallet/i });
    await connectBtn.click();

    const expectedLabel = getShortAddress(mockClientPublicKey);
    const connectedBtn = page.getByRole('button', { name: /Connected wallet/i });
    await expect(connectedBtn).toBeVisible();

    // Reload page
    await page.reload();

    // Verify session persists and still displays shortened address
    await expect(connectedBtn).toBeVisible();
    await expect(connectedBtn.locator('span').first()).toHaveText(expectedLabel);
  });

  test('should clear wallet state and delete session upon disconnection', async ({ page }) => {
    await page.goto('/');
    const connectBtn = page.getByRole('button', { name: /Connect Wallet/i });
    await connectBtn.click();

    const connectedBtn = page.getByRole('button', { name: /Connected wallet/i });
    await expect(connectedBtn).toBeVisible();

    // Toggle dropdown
    await connectedBtn.click();

    // Click disconnect button
    const disconnectBtn = page.getByRole('button', { name: /Disconnect Wallet/i });
    await expect(disconnectBtn).toBeVisible();
    await disconnectBtn.click();

    // Assert it reverts back to "Connect Wallet"
    await expect(connectBtn).toBeVisible();

    // Reload and assert state remains disconnected
    await page.reload();
    await expect(connectBtn).toBeVisible();
  });

  test('should allow re-connecting successfully after a disconnection', async ({ page }) => {
    await page.goto('/');
    const connectBtn = page.getByRole('button', { name: /Connect Wallet/i });
    await connectBtn.click();

    const connectedBtn = page.getByRole('button', { name: /Connected wallet/i });
    await expect(connectedBtn).toBeVisible();

    // Disconnect
    await connectedBtn.click();
    await page.getByRole('button', { name: /Disconnect Wallet/i }).click();
    await expect(connectBtn).toBeVisible();

    // Connect again
    await connectBtn.click();
    await expect(connectedBtn).toBeVisible();
  });

  test('should handle user rejection of public key request (connection cancel)', async ({ page }) => {
    await page.goto('/');

    // Configure mock wallet to throw an error on getPublicKey
    await page.evaluate(() => {
      (window as any).__mockGetPublicKeyError = 'User rejected connection request';
    });

    const connectBtn = page.getByRole('button', { name: /Connect Wallet/i });
    await connectBtn.click();

    // Verify connect button is still shown
    await expect(connectBtn).toBeVisible();

    // Verify error is shown in the UI
    const errorSpan = page.locator('[data-testid="wallet-error"]');
    await expect(errorSpan).toBeVisible();
    await expect(errorSpan).toHaveText(/User rejected connection request/i);
  });

  test('should handle user cancellation of signature request (signature cancel)', async ({ page }) => {
    await page.goto('/');

    // Configure mock wallet to throw an error on signTransaction
    await page.evaluate(() => {
      (window as any).__mockSignTransactionError = 'User cancelled transaction signing';
    });

    const connectBtn = page.getByRole('button', { name: /Connect Wallet/i });
    await connectBtn.click();

    // Verify connect button is still shown
    await expect(connectBtn).toBeVisible();

    // Verify error is shown in the UI
    const errorSpan = page.locator('[data-testid="wallet-error"]');
    await expect(errorSpan).toBeVisible();
    await expect(errorSpan).toHaveText(/User cancelled transaction signing/i);
  });

  test('should handle verification failures on server side gracefully', async ({ page }) => {
    // Override mockSignTransaction exposed function to return invalid transaction/signature.
    // Expose a different function or overwrite the mock sign to return invalid signature.
    await page.exposeFunction('mockSignTransactionInvalid', async (xdr: string) => {
      // Return a signed transaction from a COMPLETELY DIFFERENT keypair
      // which will cause server verification to fail.
      const differentKeypair = Keypair.random();
      const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
      tx.sign(differentKeypair);
      return tx.toXDR();
    });

    await page.goto('/');

    // Tell window.stellar to call the invalid signer instead
    await page.evaluate(() => {
      if (window.stellar) {
        window.stellar.signTransaction = async (xdr) => {
          return (window as any).mockSignTransactionInvalid(xdr);
        };
      }
    });

    const connectBtn = page.getByRole('button', { name: /Connect Wallet/i });
    await connectBtn.click();

    // Verify connect button is still shown
    await expect(connectBtn).toBeVisible();

    // Verify error is shown in the UI (since server will reject with 401)
    const errorSpan = page.locator('[data-testid="wallet-error"]');
    await expect(errorSpan).toBeVisible();
    await expect(errorSpan).toHaveText(/Verification failed|Signature verification failed/i);
  });
});
