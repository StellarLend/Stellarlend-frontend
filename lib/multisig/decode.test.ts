// @vitest-environment node
import { describe, it, expect } from "vitest";
import { xdr, Address, nativeToScVal } from "@stellar/stellar-sdk";
import {
  decodeProposalAction,
  decodeScVal,
  shortenAddress,
} from "./decode";

describe("ProposalAction Decoding", () => {
  const contractId = "CC4A6A46O2KQA7KEMOFK3TQ4YRSLCJ4ZP26SQWXIKNF4DTEX3BOL2HF6";
  const signer1 = "GBSRKAMUOPCLSN75TJLM52HF55R6KOH7PMSA4XDNPXXNBDWBTLMPJEOI";
  const signer2 = "GBSXPC5X665CKCIUMUHLAKVRQNYA5XCNIWV2Q3QVUNLIVL7IJIQWTSFG";

  describe("SetThreshold Variant", () => {
    it("decodes SetThreshold from XDR fixture", () => {
      const fixture = xdr.ScVal.scvVec([
        xdr.ScVal.scvSymbol("SetThreshold"),
        xdr.ScVal.scvU32(3),
      ]);

      const decoded = decodeProposalAction(fixture);
      expect(decoded.kind).toBe("SetThreshold");
      if (decoded.kind === "SetThreshold") {
        expect(decoded.threshold).toBe(3);
        expect(decoded.summary).toBe("Set threshold to 3");
      }
    });

    it("decodes SetThreshold from native array fixture", () => {
      const decoded = decodeProposalAction(["SetThreshold", 4]);
      expect(decoded.kind).toBe("SetThreshold");
      if (decoded.kind === "SetThreshold") {
        expect(decoded.threshold).toBe(4);
        expect(decoded.summary).toBe("Set threshold to 4");
      }
    });

    it("decodes SetThreshold from native object fixture", () => {
      const decoded = decodeProposalAction({ SetThreshold: 2 });
      expect(decoded.kind).toBe("SetThreshold");
      if (decoded.kind === "SetThreshold") {
        expect(decoded.threshold).toBe(2);
        expect(decoded.summary).toBe("Set threshold to 2");
      }
    });
  });

  describe("RotateSigners Variant", () => {
    it("decodes RotateSigners from XDR fixture", () => {
      const fixture = xdr.ScVal.scvVec([
        xdr.ScVal.scvSymbol("RotateSigners"),
        xdr.ScVal.scvVec([
          new Address(signer1).toScVal(),
          new Address(signer2).toScVal(),
        ]),
      ]);

      const decoded = decodeProposalAction(fixture);
      expect(decoded.kind).toBe("RotateSigners");
      if (decoded.kind === "RotateSigners") {
        expect(decoded.signers).toEqual([signer1, signer2]);
        expect(decoded.summary).toContain("Rotate signers to 2 signers");
        expect(decoded.summary).toContain(shortenAddress(signer1));
        expect(decoded.summary).toContain(shortenAddress(signer2));
      }
    });

    it("decodes RotateSigners from native array fixture", () => {
      const decoded = decodeProposalAction(["RotateSigners", [signer1, signer2]]);
      expect(decoded.kind).toBe("RotateSigners");
      if (decoded.kind === "RotateSigners") {
        expect(decoded.signers).toEqual([signer1, signer2]);
        expect(decoded.summary).toContain("Rotate signers to 2 signers");
      }
    });
  });

  describe("InvokeContract Variant", () => {
    it("decodes InvokeContract with nested Vec, i128, Address, Symbol, Bytes, and bool args", () => {
      const i128Arg = nativeToScVal(12500000000n, { type: "i128" });
      const addrArg = new Address(signer1).toScVal();
      const symbolArg = xdr.ScVal.scvSymbol("active");
      const bytesArg = xdr.ScVal.scvBytes(Buffer.from("cafebabe1234", "hex"));
      const boolArg = xdr.ScVal.scvBool(true);

      const nestedVecArg = xdr.ScVal.scvVec([
        nativeToScVal(9999n, { type: "i128" }),
        xdr.ScVal.scvBool(false),
        xdr.ScVal.scvSymbol("inner_tag"),
      ]);

      const fixture = xdr.ScVal.scvVec([
        xdr.ScVal.scvSymbol("InvokeContract"),
        new Address(contractId).toScVal(),
        xdr.ScVal.scvSymbol("set_pause"),
        xdr.ScVal.scvVec([
          i128Arg,
          addrArg,
          symbolArg,
          bytesArg,
          boolArg,
          nestedVecArg,
        ]),
      ]);

      const decoded = decodeProposalAction(fixture);
      expect(decoded.kind).toBe("InvokeContract");

      if (decoded.kind === "InvokeContract") {
        expect(decoded.contract).toBe(contractId);
        expect(decoded.functionName).toBe("set_pause");
        expect(decoded.args).toHaveLength(6);

        // 1. i128 arg
        expect(decoded.args[0].type).toBe("i128");
        expect(decoded.args[0].formatted).toBe("12500000000");

        // 2. Address arg
        expect(decoded.args[1].type).toBe("Address");
        expect(decoded.args[1].address).toBe(signer1);
        expect(decoded.args[1].isAddress).toBe(true);
        expect(decoded.args[1].formatted).toBe(signer1);

        // 3. Symbol arg
        expect(decoded.args[2].type).toBe("Symbol");
        expect(decoded.args[2].formatted).toBe(":active");

        // 4. Bytes arg
        expect(decoded.args[3].type).toBe("Bytes");
        expect(decoded.args[3].formatted).toBe("0xcafebabe1234");

        // 5. bool arg
        expect(decoded.args[4].type).toBe("bool");
        expect(decoded.args[4].formatted).toBe("true");

        // 6. nested Vec arg
        expect(decoded.args[5].type).toBe("Vec");
        expect(decoded.args[5].formatted).toContain("9999");
        expect(decoded.args[5].formatted).toContain("false");
        expect(decoded.args[5].formatted).toContain(":inner_tag");

        // Human-readable summary
        expect(decoded.summary).toBe(
          `Invoke set_pause on ${shortenAddress(contractId)} with args (12500000000, ${signer1}, :active, 0xcafebabe1234, true, [9999, false, :inner_tag])`
        );
      }
    });

    it("decodes InvokeContract with zero args", () => {
      const fixture = xdr.ScVal.scvVec([
        xdr.ScVal.scvSymbol("InvokeContract"),
        new Address(contractId).toScVal(),
        xdr.ScVal.scvSymbol("pause_all"),
        xdr.ScVal.scvVec([]),
      ]);

      const decoded = decodeProposalAction(fixture);
      expect(decoded.kind).toBe("InvokeContract");
      if (decoded.kind === "InvokeContract") {
        expect(decoded.args).toHaveLength(0);
        expect(decoded.summary).toBe(`Invoke pause_all on ${shortenAddress(contractId)} with args ()`);
      }
    });
  });

  describe("Unknown and Malformed Variants", () => {
    it("handles unknown variant tag safely", () => {
      const fixture = xdr.ScVal.scvVec([
        xdr.ScVal.scvSymbol("MigrateTreasury"),
        xdr.ScVal.scvU32(100),
      ]);

      const decoded = decodeProposalAction(fixture);
      expect(decoded.kind).toBe("Unknown");
      expect(decoded.summary).toBe("Unknown action format");
    });

    it("handles empty vector safely", () => {
      const fixture = xdr.ScVal.scvVec([]);
      const decoded = decodeProposalAction(fixture);
      expect(decoded.kind).toBe("Unknown");
    });

    it("handles non-vector ScVal safely", () => {
      const fixture = xdr.ScVal.scvU32(42);
      const decoded = decodeProposalAction(fixture);
      expect(decoded.kind).toBe("Unknown");
    });

    it("handles null and undefined input safely", () => {
      expect(decodeProposalAction(null).kind).toBe("Unknown");
      expect(decodeProposalAction(undefined).kind).toBe("Unknown");
    });

    it("preserves raw string actions", () => {
      const rawText = "Update collateral factor for USDC";
      const decoded = decodeProposalAction(rawText);
      expect(decoded.kind).toBe("Unknown");
      expect(decoded.summary).toBe(rawText);
    });
  });

  describe("shortenAddress Helper", () => {
    it("shortens address correctly", () => {
      expect(shortenAddress(contractId)).toBe("CC4A…2HF6");
      expect(shortenAddress(signer1, 6, 6)).toBe("GBSRKA…MPJEOI");
      expect(shortenAddress("short")).toBe("short");
      expect(shortenAddress("")).toBe("");
    });
  });
});
