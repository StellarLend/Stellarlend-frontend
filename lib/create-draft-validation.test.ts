import { describe, expect, it } from "vitest";
import {
  assertAuthorizedDraftAccess,
  getResumeDraftAccessError,
  parseCreateRouteParams,
} from "@/components/create/ResumeDraftPrompt";

const walletAddress = `G${"A".repeat(55)}`;
const secondWallet = `G${"B".repeat(55)}`;
const routeDraft = { id: "draft-123", owner: walletAddress, network: "TESTNET", amount: 250, token: "token-abc" };

describe("create draft validation", () => {
  it("accepts a valid draft resume request", () => {
    const parsed = assertAuthorizedDraftAccess({
      draftId: "draft-123",
      routeToken: "token-abc",
      wallet: { address: walletAddress, network: "TESTNET", connected: true },
      draft: routeDraft,
    });

    expect(parsed).toMatchObject({ draftId: "draft-123", walletAddress, network: "TESTNET", amount: 250 });
  });

  it("rejects disconnected wallets before resuming", () => {
    expect(() =>
      assertAuthorizedDraftAccess({
        draftId: "draft-123",
        routeToken: "token-abc",
        wallet: { address: null, network: "TESTNET", connected: false },
        draft: routeDraft,
      }),
    ).toThrowError(/Wallet must be connected before resuming a draft/);
  });

  it("rejects wrong-network resumes", () => {
    expect(() =>
      assertAuthorizedDraftAccess({
        draftId: "draft-123",
        routeToken: "token-abc",
        wallet: { address: walletAddress, network: "PUBLIC", connected: true },
        draft: routeDraft,
      }),
    ).toThrowError(/does not match draft network/i);
  });

  it("rejects tampered route tokens", () => {
    expect(() =>
      assertAuthorizedDraftAccess({
        draftId: "draft-123",
        routeToken: "tampered",
        wallet: { address: walletAddress, network: "TESTNET", connected: true },
        draft: routeDraft,
      }),
    ).toThrowError(/does not match the server response/i);
  });

  it("rejects malformed server responses", () => {
    expect(() =>
      assertAuthorizedDraftAccess({
        draftId: "draft-123",
        routeToken: "token-abc",
        wallet: { address: walletAddress, network: "TESTNET", connected: true },
        draft: { ...routeDraft, owner: undefined, amount: "not-a-number" },
      }),
    ).toThrowError(/missing owner address|Invalid numeric value/i);
  });

  it("parses route parameters and validates route data", () => {
    expect(parseCreateRouteParams({ draftId: "draft-123", resumeToken: "token-abc", network: "TESTNET" })).toEqual({
      draftId: "draft-123",
      routeToken: "token-abc",
      network: "TESTNET",
      walletAddress: undefined,
    });

    expect(() => parseCreateRouteParams({ draftId: "", network: "UNKNOWN" })).toThrowError(/draftId is required|Unsupported network/i);
  });

  it("captures unauthorized resume attempts as validation errors", () => {
    const error = getResumeDraftAccessError(
      routeDraft,
      { address: secondWallet, network: "TESTNET", connected: true },
      "draft-123",
      "token-abc",
    );

    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/does not own the draft/i);
  });

  it("allows retry after a valid recheck", () => {
    const error = getResumeDraftAccessError(
      routeDraft,
      { address: walletAddress, network: "TESTNET", connected: true },
      "draft-123",
      "token-abc",
    );

    expect(error).toBeNull();
  });
});
