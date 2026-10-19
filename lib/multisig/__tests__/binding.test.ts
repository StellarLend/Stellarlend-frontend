// @vitest-environment node
import { describe, it, expect } from "vitest";
import { StrKey, Address, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import {
  APPROVAL_DOMAIN_SEPARATOR,
  buildApprovalBindingPreimage,
  computeApprovalBindingHash,
  verifyAuthEntryBinding,
} from "../binding";

describe("Approval Binding Cryptographic Verification", () => {
  const contractRaw = Buffer.from("1122334455667788990011223344556677889900112233445566778899001122", "hex");
  const contractId = StrKey.encodeContract(contractRaw);

  const approverRaw = Buffer.from("aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899", "hex");
  const approver = StrKey.encodeEd25519PublicKey(approverRaw);

  const proposalId = BigInt(42);
  const signerSetHash = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";

  it("enforces canonical domain separator", () => {
    expect(APPROVAL_DOMAIN_SEPARATOR.toString("utf8")).toBe("STELLARLEND_MULTISIG_APPROVAL_V1");
    expect(APPROVAL_DOMAIN_SEPARATOR.length).toBe(32);
  });

  it("rejects signer_set_hash that is not 32 bytes", () => {
    expect(() =>
      buildApprovalBindingPreimage(contractId, proposalId, approver, "1234")
    ).toThrow("signer_set_hash must be exactly 32 bytes");
  });

  it("matches known deterministic test vectors (Vector 1)", () => {
    const preimage = buildApprovalBindingPreimage(contractId, proposalId, approver, signerSetHash);
    expect(preimage.length).toBe(148);

    const hash = computeApprovalBindingHash(contractId, proposalId, approver, signerSetHash);
    expect(hash.toString("hex")).toBe("d7da95f5b92bac9cd72c67f576bb216375eeb5a5d0f93079715993e07596710b");
  });

  it("matches known deterministic test vectors (Vector 2)", () => {
    const contractRaw2 = Buffer.from("0000000000000000000000000000000000000000000000000000000000000001", "hex");
    const contractId2 = StrKey.encodeContract(contractRaw2);

    const approverRaw2 = Buffer.from("0000000000000000000000000000000000000000000000000000000000000001", "hex");
    const approver2 = StrKey.encodeEd25519PublicKey(approverRaw2);

    const hash2 = computeApprovalBindingHash(
      contractId2,
      BigInt(1),
      approver2,
      "0000000000000000000000000000000000000000000000000000000000000001"
    );
    expect(hash2.toString("hex")).toBe("8842384f58fc73bb88e45c4c39b9d92d250e5d42322185e8d36bfe6203ded6c3");
  });

  it("successfully validates auth entry when simulated binding hash matches", () => {
    const hash = computeApprovalBindingHash(contractId, proposalId, approver, signerSetHash);

    const mockAuthEntry = {
      rootInvocation: {
        function: {
          contractFn: {
            args: [xdr.ScVal.scvBytes(new Uint8Array(hash))],
          },
        },
        subInvocations: [],
      },
    };

    const isValid = verifyAuthEntryBinding(mockAuthEntry, hash);
    expect(isValid).toBe(true);
  });

  it("successfully validates auth entry with hex string input", () => {
    const hash = computeApprovalBindingHash(contractId, proposalId, approver, signerSetHash);

    const mockAuthEntry = {
      args: [hash.toString("hex")],
    };

    const isValid = verifyAuthEntryBinding(mockAuthEntry, hash.toString("hex"));
    expect(isValid).toBe(true);
  });

  it("rejects auth entry when binding hash does not match (detects tampering/mismatch)", () => {
    const hash = computeApprovalBindingHash(contractId, proposalId, approver, signerSetHash);
    const tamperedHash = Buffer.from("99".repeat(32), "hex");

    const mockAuthEntry = {
      rootInvocation: {
        function: {
          contractFn: {
            args: [xdr.ScVal.scvBytes(new Uint8Array(tamperedHash))],
          },
        },
      },
    };

    const isValid = verifyAuthEntryBinding(mockAuthEntry, hash);
    expect(isValid).toBe(false);
  });

  it("gracefully handles null, undefined, or empty auth entry", () => {
    expect(verifyAuthEntryBinding(null, Buffer.alloc(32))).toBe(false);
    expect(verifyAuthEntryBinding({}, Buffer.alloc(32))).toBe(false);
  });
});
