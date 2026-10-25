import { Page } from "@playwright/test";

export type FreighterScenario =
  | { status: "not_installed" }
  | { status: "declined" }
  | { status: "connected"; address: string };

/**
 * Injects a deterministic stub for @stellar/freighter-api into the browser page.
 *
 * @stellar/freighter-api communicates with the Freighter browser extension via
 * window.postMessage:
 * - Requests are dispatched with: { source: "FREIGHTER_EXTERNAL_MSG_REQUEST", messageId, type: ... }
 * - Responses are expected with: { source: "FREIGHTER_EXTERNAL_MSG_RESPONSE", messagedId, ...payload }
 * (note the freighter-api typo `messagedId`).
 *
 * Also checks `window.freighter` for isConnected() fallback:
 *   isConnected: () => window.freighter ? Promise.resolve({ isConnected: window.freighter }) : ...
 */
export async function setupFreighterMock(page: Page, scenario: FreighterScenario) {
  await page.addInitScript((sc) => {
    // Clear any previous state
    if (sc.status === "not_installed") {
      // Do not set window.freighter or respond to messages
      return;
    }

    // Mark window.freighter as true so isConnected() immediately resolves true
    (window as unknown as { freighter: boolean }).freighter = true;

    window.addEventListener("message", (event: MessageEvent) => {
      // Security/origin check: must originate from window
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.source !== "FREIGHTER_EXTERNAL_MSG_REQUEST") return;

      const messageId = data.messageId;
      const type = data.type;

      if (type === "REQUEST_CONNECTION_STATUS") {
        window.postMessage(
          {
            source: "FREIGHTER_EXTERNAL_MSG_RESPONSE",
            messagedId: messageId,
            isConnected: true,
          },
          window.location.origin
        );
      } else if (type === "REQUEST_ACCESS") {
        if (sc.status === "declined") {
          window.postMessage(
            {
              source: "FREIGHTER_EXTERNAL_MSG_RESPONSE",
              messagedId: messageId,
              publicKey: "",
              apiError: "User declined access",
            },
            window.location.origin
          );
        } else if (sc.status === "connected") {
          window.postMessage(
            {
              source: "FREIGHTER_EXTERNAL_MSG_RESPONSE",
              messagedId: messageId,
              publicKey: sc.address,
            },
            window.location.origin
          );
        }
      } else if (type === "REQUEST_NETWORK_DETAILS" || type === "REQUEST_NETWORK") {
        window.postMessage(
          {
            source: "FREIGHTER_EXTERNAL_MSG_RESPONSE",
            messagedId: messageId,
            networkDetails: {
              network: "TESTNET",
              networkUrl: "https://horizon-testnet.stellar.org",
              networkPassphrase: "Test SDF Network ; September 2015",
            },
          },
          window.location.origin
        );
      }
    });
  }, scenario);
}

export type HorizonAccountMockOptions = {
  address: string;
  funded: boolean;
  nativeBalance?: string;
};

/**
 * Intercepts calls to Horizon /accounts/<address> to return deterministic balances
 * without external network access.
 */
export async function mockHorizonAccount(page: Page, options: HorizonAccountMockOptions) {
  const { address, funded, nativeBalance = "100.0000000" } = options;
  const endpointPattern = `**/accounts/${address}*`;

  await page.route(endpointPattern, async (route) => {
    if (!funded) {
      // 404 Not Found for unfunded account
      await route.fulfill({
        status: 404,
        contentType: "application/problem+json",
        body: JSON.stringify({
          type: "https://stellar.org/horizon-errors/not_found",
          title: "Resource Missing",
          status: 404,
          detail: "The resource at the url requested was not found.",
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: address,
        account_id: address,
        sequence: "123456789",
        balances: [
          {
            balance: nativeBalance,
            asset_type: "native",
          },
        ],
      }),
    });
  });
}
