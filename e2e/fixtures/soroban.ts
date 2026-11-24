import { Page } from "@playwright/test";
import { nativeToScVal } from "@stellar/stellar-sdk";

export interface SorobanScenario {
  position?: { collateral: bigint; debt: bigint; healthFactor: bigint };
  minBorrow?: bigint;
  failSend?: boolean;
}

export async function mockSorobanRpc(
  page: Page,
  getScenario: () => SorobanScenario,
) {
  // 1. Abort requests to any unmocked external host
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (
      url.startsWith("http://localhost") ||
      url.startsWith("http://127.0.0.1") ||
      url.includes("stellar.org")
    ) {
      return route.continue();
    }
    return route.abort();
  });

  // 2. Mock Freighter transaction signing via postMessage
  await page.addInitScript(() => {
    window.addEventListener("message", (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.source !== "FREIGHTER_EXTERNAL_MSG_REQUEST") return;

      if (
        data.type === "REQUEST_SIGN_TRANSACTION" ||
        data.type === "SIGN_TRANSACTION"
      ) {
        window.postMessage(
          {
            source: "FREIGHTER_EXTERNAL_MSG_RESPONSE",
            messagedId: data.messageId,
            signedTxXdr: data.transactionXdr,
          },
          window.location.origin,
        );
      }
    });
  });

  // 3. Mock Soroban RPC methods
  await page.route("**/soroban-testnet.stellar.org/**", async (route) => {
    const postData = route.request().postDataJSON();
    const method = postData?.method;
    const id = postData?.id ?? 1;
    const scenario = getScenario();

    if (method === "getAccount") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id,
          result: {
            id:
              postData.params?.[0] ||
              postData.params?.address ||
              "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
            sequence: "12345678",
          },
        }),
      });
    }

    if (method === "getLatestLedger") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id,
          result: {
            id: "ledger-1234",
            sequence: 1234,
            protocolVersion: 20,
          },
        }),
      });
    }

    if (method === "simulateTransaction") {
      const pos = scenario.position ?? {
        collateral: 0n,
        debt: 0n,
        healthFactor: 100_000_000n,
      };
      const retvalScVal = nativeToScVal({
        collateral: pos.collateral,
        debt: pos.debt,
        health_factor: pos.healthFactor,
      }).toXDR("base64");

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id,
          result: {
            minResourceFee: "100",
            latestLedger: 1234,
            result: {
              retval: retvalScVal,
            },
            results: [
              {
                retval: retvalScVal,
              },
            ],
            transactionData: "AAAAAgAAAAA=",
          },
        }),
      });
    }

    if (method === "sendTransaction") {
      if (scenario.failSend) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: {
              status: "ERROR",
              errorResult: "AAAAAA==",
            },
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id,
          result: {
            status: "PENDING",
            hash: "mock-tx-hash-12345678",
          },
        }),
      });
    }

    if (method === "getTransaction") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id,
          result: {
            status: "SUCCESS",
            latestLedger: 1235,
          },
        }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ jsonrpc: "2.0", id, result: {} }),
    });
  });
}
