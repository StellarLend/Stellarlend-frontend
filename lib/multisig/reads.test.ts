// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { xdr, Address, StrKey } from "@stellar/stellar-sdk";
import {
  getMultisigOverview,
  getProposal,
  getProposalDetail,
  listProposals,
  probeProposalIds,
  discoverProposalIdsViaEvents,
  isProposalNotFoundError,
  extractProposalIdFromEvent,
} from "./reads";

describe("Multisig Reads & Discovery", () => {
  const contractId = "CC4A6A46O2KQA7KEMOFK3TQ4YRSLCJ4ZP26SQWXIKNF4DTEX3BOL2HF6";
  const signer1 = "GBSRKAMUOPCLSN75TJLM52HF55R6KOH7PMSA4XDNPXXNBDWBTLMPJEOI";
  const signer2 = "GBSXPC5X665CKCIUMUHLAKVRQNYA5XCNIWV2Q3QVUNLIVL7IJIQWTSFG";
  const currentSignerSetHash = "0000000000000000000000000000000000000000000000000000000000000001";

  // Helper to create a mock simulation response
  const createMockSimulationResponse = (retval: xdr.ScVal) => ({
    _parsed: true,
    result: {
      retval,
    },
  });

  describe("getMultisigOverview", () => {
    it("returns overview with threshold, signers, signerSetHash, and currentLedger", async () => {
      const mockRpcServer = {
        simulateTransaction: vi.fn().mockImplementation((tx) => {
          const op = tx.operations[0];
          const func = op.function;

          if (func === "get_threshold") {
            return Promise.resolve(createMockSimulationResponse(xdr.ScVal.scvU32(2)));
          }
          if (func === "get_signers") {
            return Promise.resolve(
              createMockSimulationResponse(
                xdr.ScVal.scvVec([
                  new Address(signer1).toScVal(),
                  new Address(signer2).toScVal(),
                ])
              )
            );
          }
          if (func === "get_signer_set_hash") {
            return Promise.resolve(
              createMockSimulationResponse(
                xdr.ScVal.scvBytes(Buffer.from(currentSignerSetHash, "hex"))
              )
            );
          }
          return Promise.reject(new Error(`Unexpected function: ${func}`));
        }),
        getLatestLedger: vi.fn().mockResolvedValue({
          id: "ledger123",
          sequence: 1250000,
          protocolVersion: 21,
        }),
      } as any;

      const overview = await getMultisigOverview(contractId, mockRpcServer);
      expect(overview).not.toBeNull();
      expect(overview?.threshold).toBe(2);
      expect(overview?.signers).toEqual([signer1, signer2]);
      expect(overview?.signerSetHash).toBe(currentSignerSetHash);
      expect(overview?.currentLedger).toBe(1250000);
    });

    it("returns null when contractId is empty without making any RPC calls", async () => {
      const mockRpcServer = {
        simulateTransaction: vi.fn(),
        getLatestLedger: vi.fn(),
      } as any;

      const overview = await getMultisigOverview("", mockRpcServer);
      expect(overview).toBeNull();
      expect(mockRpcServer.simulateTransaction).not.toHaveBeenCalled();
      expect(mockRpcServer.getLatestLedger).not.toHaveBeenCalled();
    });
  });

  describe("Event-based Discovery", () => {
    it("extracts proposal ID from event topic and value", () => {
      // Event with ID in topic
      const topicEvent = {
        topic: [xdr.ScVal.scvSymbol("ProposalCreated"), xdr.ScVal.scvU32(5)],
        value: xdr.ScVal.scvVoid(),
      };
      expect(extractProposalIdFromEvent(topicEvent)).toBe(5);

      // Event with ID in value object
      const valueEvent = {
        topic: [xdr.ScVal.scvSymbol("ProposalCreated")],
        value: xdr.ScVal.scvU32(8),
      };
      expect(extractProposalIdFromEvent(valueEvent)).toBe(8);
    });

    it("discovers proposal IDs using getEvents", async () => {
      const mockRpcServer = {
        getEvents: vi.fn().mockResolvedValue({
          events: [
            {
              topic: [xdr.ScVal.scvSymbol("ProposalCreated"), xdr.ScVal.scvU32(1)],
              value: xdr.ScVal.scvVoid(),
            },
            {
              topic: [xdr.ScVal.scvSymbol("ProposalCreated"), xdr.ScVal.scvU32(2)],
              value: xdr.ScVal.scvVoid(),
            },
          ],
        }),
      } as any;

      const ids = await discoverProposalIdsViaEvents(contractId, mockRpcServer, 1000);
      expect(ids).toEqual([1, 2]);
      expect(mockRpcServer.getEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.arrayContaining([
            expect.objectContaining({ contractIds: [contractId] }),
          ]),
        })
      );
    });
  });

  describe("Probing Fallback with Bounded Concurrency", () => {
    it("probes in batches of 4 and stops immediately at the first ProposalNotFound without hammering RPC", async () => {
      const probedIds: number[] = [];

      const mockRpcServer = {
        simulateTransaction: vi.fn().mockImplementation((tx) => {
          const op = tx.operations[0];
          const func = op.function;

          if (func === "get_proposal") {
            const idVal = op.args[0];
            const id = idVal.u32();
            probedIds.push(id);

            // IDs 1 and 2 exist, ID 3 returns ProposalNotFound (Contract error #2)
            if (id === 1 || id === 2) {
              const proposalStruct = xdr.ScVal.scvVec([
                xdr.ScVal.scvSymbol("Proposal"),
                xdr.ScVal.scvMap([
                  new xdr.ScMapEntry({
                    key: xdr.ScVal.scvSymbol("id"),
                    val: xdr.ScVal.scvU32(id),
                  }),
                  new xdr.ScMapEntry({
                    key: xdr.ScVal.scvSymbol("proposer"),
                    val: new Address(signer1).toScVal(),
                  }),
                  new xdr.ScMapEntry({
                    key: xdr.ScVal.scvSymbol("action"),
                    val: xdr.ScVal.scvVec([
                      xdr.ScVal.scvSymbol("SetThreshold"),
                      xdr.ScVal.scvU32(2),
                    ]),
                  }),
                  new xdr.ScMapEntry({
                    key: xdr.ScVal.scvSymbol("payload_hash"),
                    val: xdr.ScVal.scvBytes(Buffer.from("00".repeat(32), "hex")),
                  }),
                  new xdr.ScMapEntry({
                    key: xdr.ScVal.scvSymbol("approvals"),
                    val: xdr.ScVal.scvVec([new Address(signer1).toScVal()]),
                  }),
                  new xdr.ScMapEntry({
                    key: xdr.ScVal.scvSymbol("status"),
                    val: xdr.ScVal.scvSymbol("Active"),
                  }),
                  new xdr.ScMapEntry({
                    key: xdr.ScVal.scvSymbol("expires_at"),
                    val: xdr.ScVal.scvU32(1300000),
                  }),
                ]),
              ]);

              return Promise.resolve(createMockSimulationResponse(proposalStruct));
            } else {
              // Return ProposalNotFound simulation error for ID >= 3
              return Promise.resolve({
                _parsed: true,
                error: "HostError: Error(Contract, #2)",
              });
            }
          }
          return Promise.resolve({ _parsed: true, error: "Unknown" });
        }),
      } as any;

      const discoveredIds = await probeProposalIds(contractId, mockRpcServer, 4);

      // Should discover proposals 1 and 2
      expect(discoveredIds).toEqual([1, 2]);

      // Batch 1 tested IDs 1, 2, 3, 4
      expect(probedIds).toContain(1);
      expect(probedIds).toContain(2);
      expect(probedIds).toContain(3);
      expect(probedIds).toContain(4);

      // Crucially, batch 2 (IDs 5, 6, 7, 8) must NEVER have been probed
      expect(probedIds).not.toContain(5);
      expect(probedIds).not.toContain(6);
      expect(probedIds).not.toContain(7);
      expect(probedIds).not.toContain(8);
    });
  });

  describe("listProposals integration", () => {
    it("falls back to probing when getEvents fails or returns empty", async () => {
      const mockRpcServer = {
        getLatestLedger: vi.fn().mockResolvedValue({ sequence: 1250000 }),
        getEvents: vi.fn().mockRejectedValue(new Error("RPC retention window expired")),
        simulateTransaction: vi.fn().mockImplementation((tx) => {
          const op = tx.operations[0];
          const func = op.function;

          if (func === "get_threshold") {
            return Promise.resolve(createMockSimulationResponse(xdr.ScVal.scvU32(2)));
          }
          if (func === "get_signers") {
            return Promise.resolve(
              createMockSimulationResponse(
                xdr.ScVal.scvVec([new Address(signer1).toScVal()])
              )
            );
          }
          if (func === "get_signer_set_hash") {
            return Promise.resolve(
              createMockSimulationResponse(
                xdr.ScVal.scvBytes(Buffer.from(currentSignerSetHash, "hex"))
              )
            );
          }
          if (func === "get_proposal") {
            const id = op.args[0].u32();
            if (id === 1) {
              return Promise.resolve(
                createMockSimulationResponse(
                  xdr.ScVal.scvMap([
                    new xdr.ScMapEntry({
                      key: xdr.ScVal.scvSymbol("id"),
                      val: xdr.ScVal.scvU32(1),
                    }),
                    new xdr.ScMapEntry({
                      key: xdr.ScVal.scvSymbol("proposer"),
                      val: new Address(signer1).toScVal(),
                    }),
                    new xdr.ScMapEntry({
                      key: xdr.ScVal.scvSymbol("action"),
                      val: xdr.ScVal.scvVec([
                        xdr.ScVal.scvSymbol("SetThreshold"),
                        xdr.ScVal.scvU32(2),
                      ]),
                    }),
                    new xdr.ScMapEntry({
                      key: xdr.ScVal.scvSymbol("payload_hash"),
                      val: xdr.ScVal.scvBytes(Buffer.from("00".repeat(32), "hex")),
                    }),
                    new xdr.ScMapEntry({
                      key: xdr.ScVal.scvSymbol("approvals"),
                      val: xdr.ScVal.scvVec([new Address(signer1).toScVal()]),
                    }),
                    new xdr.ScMapEntry({
                      key: xdr.ScVal.scvSymbol("status"),
                      val: xdr.ScVal.scvSymbol("Active"),
                    }),
                    new xdr.ScMapEntry({
                      key: xdr.ScVal.scvSymbol("expires_at"),
                      val: xdr.ScVal.scvU32(1200000), // In the past -> should be effective Expired
                    }),
                  ])
                )
              );
            }
            // ID > 1 is ProposalNotFound
            return Promise.resolve({
              _parsed: true,
              error: "HostError: Error(Contract, #2)",
            });
          }
          if (func === "get_proposal_signer_set_hash") {
            // Signer set hash changed since creation!
            return Promise.resolve(
              createMockSimulationResponse(
                xdr.ScVal.scvBytes(Buffer.from("99".repeat(32), "hex"))
              )
            );
          }
          if (func === "get_proposal_nonce") {
            return Promise.resolve(createMockSimulationResponse(xdr.ScVal.scvU64(new xdr.Uint64(1))));
          }
          return Promise.resolve({ _parsed: true, error: "Not found" });
        }),
      } as any;

      const result = await listProposals({ contractId, rpcServer: mockRpcServer });
      expect(result.overview).not.toBeNull();
      expect(result.proposals).toHaveLength(1);

      const prop = result.proposals[0];
      expect(prop.id).toBe(1);
      // Stored status was Active, but expires_at was 1200000 < currentLedger 1250000
      expect(prop.status).toBe("Active");
      expect(prop.effectiveStatus).toBe("Expired");
      // Signer set changed flag
      expect(prop.signerSetChanged).toBe(true);
    });

    it("handles partial failures gracefully when one proposal fetch fails", async () => {
      const mockRpcServer = {
        getLatestLedger: vi.fn().mockResolvedValue({ sequence: 1250000 }),
        getEvents: vi.fn().mockResolvedValue({
          events: [
            {
              topic: [xdr.ScVal.scvSymbol("ProposalCreated"), xdr.ScVal.scvU32(1)],
              value: xdr.ScVal.scvVoid(),
            },
            {
              topic: [xdr.ScVal.scvSymbol("ProposalCreated"), xdr.ScVal.scvU32(2)],
              value: xdr.ScVal.scvVoid(),
            },
          ],
        }),
        simulateTransaction: vi.fn().mockImplementation((tx) => {
          const op = tx.operations[0];
          const func = op.function;

          if (func === "get_threshold") {
            return Promise.resolve(createMockSimulationResponse(xdr.ScVal.scvU32(1)));
          }
          if (func === "get_signers") {
            return Promise.resolve(createMockSimulationResponse(xdr.ScVal.scvVec([])));
          }
          if (func === "get_signer_set_hash") {
            return Promise.resolve(
              createMockSimulationResponse(
                xdr.ScVal.scvBytes(Buffer.from(currentSignerSetHash, "hex"))
              )
            );
          }
          if (func === "get_proposal") {
            const id = op.args[0].u32();
            if (id === 1) {
              return Promise.resolve(
                createMockSimulationResponse(
                  xdr.ScVal.scvMap([
                    new xdr.ScMapEntry({
                      key: xdr.ScVal.scvSymbol("id"),
                      val: xdr.ScVal.scvU32(1),
                    }),
                    new xdr.ScMapEntry({
                      key: xdr.ScVal.scvSymbol("proposer"),
                      val: new Address(signer1).toScVal(),
                    }),
                    new xdr.ScMapEntry({
                      key: xdr.ScVal.scvSymbol("action"),
                      val: xdr.ScVal.scvVec([
                        xdr.ScVal.scvSymbol("SetThreshold"),
                        xdr.ScVal.scvU32(2),
                      ]),
                    }),
                    new xdr.ScMapEntry({
                      key: xdr.ScVal.scvSymbol("payload_hash"),
                      val: xdr.ScVal.scvBytes(Buffer.from("00".repeat(32), "hex")),
                    }),
                    new xdr.ScMapEntry({
                      key: xdr.ScVal.scvSymbol("approvals"),
                      val: xdr.ScVal.scvVec([]),
                    }),
                    new xdr.ScMapEntry({
                      key: xdr.ScVal.scvSymbol("status"),
                      val: xdr.ScVal.scvSymbol("Active"),
                    }),
                    new xdr.ScMapEntry({
                      key: xdr.ScVal.scvSymbol("expires_at"),
                      val: xdr.ScVal.scvU32(1300000),
                    }),
                  ])
                )
              );
            }
            // ID 2 fails with a network/RPC error
            return Promise.reject(new Error("RPC Network Timeout on proposal 2"));
          }
          return Promise.resolve({ _parsed: true, error: "Not found" });
        }),
      } as any;

      const result = await listProposals({ contractId, rpcServer: mockRpcServer });
      // Proposal 1 succeeded, partial failure on proposal 2 did not crash the explorer
      expect(result.proposals).toHaveLength(1);
      expect(result.proposals[0].id).toBe(1);
    });

    it("returns empty and makes zero RPC calls when contractId is not configured", async () => {
      const mockRpcServer = {
        simulateTransaction: vi.fn(),
        getLatestLedger: vi.fn(),
        getEvents: vi.fn(),
      } as any;

      const result = await listProposals({ contractId: "", rpcServer: mockRpcServer });
      expect(result.overview).toBeNull();
      expect(result.proposals).toEqual([]);
      expect(mockRpcServer.simulateTransaction).not.toHaveBeenCalled();
      expect(mockRpcServer.getLatestLedger).not.toHaveBeenCalled();
      expect(mockRpcServer.getEvents).not.toHaveBeenCalled();
    });
  });

  describe("isProposalNotFoundError", () => {
    it("recognizes ProposalNotFound error strings", () => {
      expect(isProposalNotFoundError("ContractError: ProposalNotFound")).toBe(true);
      expect(isProposalNotFoundError("HostError: Error(Contract, #2)")).toBe(true);
      expect(isProposalNotFoundError(new Error("Error(Contract, #2)"))).toBe(true);
      expect(isProposalNotFoundError("Unauthorized")).toBe(false);
      expect(isProposalNotFoundError(null)).toBe(false);
    });
  });
});
