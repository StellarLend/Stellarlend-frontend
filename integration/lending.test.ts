import { describe, it, expect, beforeAll } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import {
  get_position,
  get_health_factor,
  get_protocol_metrics,
  get_pause_state,
  set_pause,
} from "../lib/contract-client";

describe("Lending Contract Client Integration", () => {
  const contractId = process.env.NEXT_PUBLIC_LENDING_CONTRACT_ID || "";
  const rpcUrl = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || "http://localhost:8000/rpc";
  const userPublicKey = process.env.TEST_USER_PUBLIC_KEY || "";
  const adminSecret = process.env.TEST_ADMIN_SECRET || "";
  const expectedDeposit = BigInt(process.env.TEST_DEPOSIT_AMOUNT || "1000000000");

  beforeAll(() => {
    if (!contractId) {
      throw new Error("NEXT_PUBLIC_LENDING_CONTRACT_ID must be set for integration tests.");
    }
  });

  it("1. get_position returns collateral matching user deposit", async () => {
    const position = await get_position(userPublicKey, contractId, rpcUrl);
    expect(position).toBeDefined();
    expect(position.collateral).toBeGreaterThanOrEqual(expectedDeposit);
    expect(position.debt).toBe(0n);
  });

  it("2. get_health_factor returns healthy/no-debt sentinel value", async () => {
    const healthFactor = await get_health_factor(userPublicKey, contractId, rpcUrl);
    expect(healthFactor).toBeDefined();
    expect(healthFactor).toBeGreaterThan(0n);
    expect(healthFactor).toBeGreaterThanOrEqual(10000n);
  });

  it("3. get_protocol_metrics totals reflect deposited amounts", async () => {
    const metrics = await get_protocol_metrics(contractId, rpcUrl);
    expect(metrics).toBeDefined();
    expect(metrics.totalSupply).toBeGreaterThanOrEqual(expectedDeposit);
    expect(metrics.totalBorrow).toBeGreaterThanOrEqual(0n);
  });

  it("4. get_pause_state for 'All' returns false initially", async () => {
    const isPaused = await get_pause_state("All", contractId, rpcUrl);
    expect(isPaused).toBe(false);
  });

  it("5. set_pause changes pause state and get_pause_state asserts true", async () => {
    if (!adminSecret) {
      console.warn("TEST_ADMIN_SECRET not set, skipping live set_pause execution");
      return;
    }
    const adminKeypair = Keypair.fromSecret(adminSecret);

    await set_pause(adminKeypair, "All", true, contractId, rpcUrl);
    const isPausedNow = await get_pause_state("All", contractId, rpcUrl);
    expect(isPausedNow).toBe(true);

    await set_pause(adminKeypair, "All", false, contractId, rpcUrl);
    const isPausedRestored = await get_pause_state("All", contractId, rpcUrl);
    expect(isPausedRestored).toBe(false);
  });
});
