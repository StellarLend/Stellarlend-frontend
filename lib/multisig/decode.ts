import { Address, scValToNative, xdr } from "@stellar/stellar-sdk";

export interface DecodedVal {
  type: string;
  value: any;
  formatted: string;
  address?: string;
  isAddress?: boolean;
}

export type DecodedProposalAction =
  | {
      kind: "SetThreshold";
      threshold: number;
      summary: string;
    }
  | {
      kind: "RotateSigners";
      signers: string[];
      summary: string;
    }
  | {
      kind: "InvokeContract";
      contract: string;
      functionName: string;
      args: DecodedVal[];
      summary: string;
    }
  | {
      kind: "Unknown";
      raw: any;
      summary: string;
    };

/**
 * Shortens an address for clean display (e.g. CC4A…2HF6 or CC4A…).
 */
export function shortenAddress(
  address: string,
  lead: number = 4,
  trail: number = 4
): string {
  if (!address || typeof address !== "string") return "";
  if (trail <= 0) {
    if (address.length <= lead) return address;
    return `${address.slice(0, lead)}…`;
  }
  if (address.length <= lead + trail + 1) return address;
  return `${address.slice(0, lead)}…${address.slice(-trail)}`;
}

/**
 * Checks whether a string looks like a Stellar public key or contract address.
 */
function isStellarAddress(str: string): boolean {
  if (typeof str !== "string") return false;
  return (
    (str.startsWith("G") || str.startsWith("C")) &&
    str.length === 56 &&
    /^[A-Z0-9]{56}$/.test(str)
  );
}

/**
 * Decodes a Soroban ScVal (or native value) into a typed DecodedVal with ScVal type and formatted text.
 */
export function decodeScVal(val: xdr.ScVal | any): DecodedVal {
  if (val === null || val === undefined) {
    return { type: "Void", value: null, formatted: "()" };
  }

  // Handle xdr.ScVal instance
  if (typeof val?.switch === "function") {
    const scType = val.switch();

    switch (scType) {
      case xdr.ScValType.scvBool(): {
        const b = val.b();
        return { type: "bool", value: b, formatted: b ? "true" : "false" };
      }
      case xdr.ScValType.scvVoid(): {
        return { type: "Void", value: null, formatted: "()" };
      }
      case xdr.ScValType.scvU32(): {
        const n = val.u32();
        return { type: "u32", value: n, formatted: String(n) };
      }
      case xdr.ScValType.scvI32(): {
        const n = val.i32();
        return { type: "i32", value: n, formatted: String(n) };
      }
      case xdr.ScValType.scvU64(): {
        const native = scValToNative(val);
        return { type: "u64", value: native, formatted: String(native) };
      }
      case xdr.ScValType.scvI64(): {
        const native = scValToNative(val);
        return { type: "i64", value: native, formatted: String(native) };
      }
      case xdr.ScValType.scvTimepoint(): {
        const native = scValToNative(val);
        return { type: "Timepoint", value: native, formatted: String(native) };
      }
      case xdr.ScValType.scvDuration(): {
        const native = scValToNative(val);
        return { type: "Duration", value: native, formatted: String(native) };
      }
      case xdr.ScValType.scvU128(): {
        const native = scValToNative(val);
        return { type: "u128", value: native, formatted: String(native) };
      }
      case xdr.ScValType.scvI128(): {
        const native = scValToNative(val);
        return { type: "i128", value: native, formatted: String(native) };
      }
      case xdr.ScValType.scvU256(): {
        const native = scValToNative(val);
        return { type: "u256", value: native, formatted: String(native) };
      }
      case xdr.ScValType.scvI256(): {
        const native = scValToNative(val);
        return { type: "i256", value: native, formatted: String(native) };
      }
      case xdr.ScValType.scvBytes(): {
        const bytes = val.bytes();
        const hex = Buffer.from(bytes).toString("hex");
        return { type: "Bytes", value: hex, formatted: `0x${hex}` };
      }
      case xdr.ScValType.scvString(): {
        const str = val.str().toString();
        return { type: "String", value: str, formatted: `"${str}"` };
      }
      case xdr.ScValType.scvSymbol(): {
        const sym = val.sym().toString();
        return { type: "Symbol", value: sym, formatted: `:${sym}` };
      }
      case xdr.ScValType.scvAddress(): {
        try {
          const addr = Address.fromScVal(val).toString();
          return {
            type: "Address",
            value: addr,
            address: addr,
            isAddress: true,
            formatted: addr,
          };
        } catch {
          const native = String(scValToNative(val));
          return {
            type: "Address",
            value: native,
            address: native,
            isAddress: true,
            formatted: native,
          };
        }
      }
      case xdr.ScValType.scvVec(): {
        const items = (val.vec() || []).map((item: any) => decodeScVal(item));
        return {
          type: "Vec",
          value: items.map((i: DecodedVal) => i.value),
          formatted: `[${items.map((i: DecodedVal) => i.formatted).join(", ")}]`,
        };
      }
      case xdr.ScValType.scvMap(): {
        const entries = (val.map() || []).map((entry: any) => {
          const k = decodeScVal(entry.key());
          const v = decodeScVal(entry.val());
          return `${k.formatted}: ${v.formatted}`;
        });
        return {
          type: "Map",
          value: scValToNative(val),
          formatted: `{ ${entries.join(", ")} }`,
        };
      }
      default: {
        try {
          const native = scValToNative(val);
          return {
            type: "Unknown",
            value: native,
            formatted: String(native),
          };
        } catch {
          return { type: "Unknown", value: val, formatted: "Unknown" };
        }
      }
    }
  }

  // Handle native values
  if (typeof val === "boolean") {
    return { type: "bool", value: val, formatted: val ? "true" : "false" };
  }
  if (typeof val === "bigint") {
    return { type: "i128", value: val, formatted: val.toString() };
  }
  if (typeof val === "number") {
    return { type: "u32", value: val, formatted: String(val) };
  }
  if (Buffer.isBuffer(val) || val instanceof Uint8Array) {
    const hex = Buffer.from(val).toString("hex");
    return { type: "Bytes", value: hex, formatted: `0x${hex}` };
  }
  if (Array.isArray(val)) {
    const items = val.map(decodeScVal);
    return {
      type: "Vec",
      value: items.map((i) => i.value),
      formatted: `[${items.map((i) => i.formatted).join(", ")}]`,
    };
  }
  if (typeof val === "string") {
    if (isStellarAddress(val)) {
      return {
        type: "Address",
        value: val,
        address: val,
        isAddress: true,
        formatted: val,
      };
    }
    if (val.startsWith("0x")) {
      return { type: "Bytes", value: val.slice(2), formatted: val };
    }
    return { type: "Symbol", value: val, formatted: `:${val}` };
  }

  return { type: "Unknown", value: val, formatted: String(val) };
}

/**
 * Decodes a raw or native ProposalAction into a typed union and human-readable summary.
 */
export function decodeProposalAction(action: xdr.ScVal | any): DecodedProposalAction {
  if (!action) {
    return { kind: "Unknown", raw: action, summary: "No action data" };
  }

  try {
    // 1. ScVal vector representation (standard Soroban enum tuple variant)
    if (typeof action?.switch === "function" && action.switch() === xdr.ScValType.scvVec()) {
      const vec = action.vec() || [];
      if (vec.length >= 2) {
        const tagVal = vec[0];
        let tag = "";
        if (tagVal.switch() === xdr.ScValType.scvSymbol()) {
          tag = tagVal.sym().toString();
        } else if (tagVal.switch() === xdr.ScValType.scvString()) {
          tag = tagVal.str().toString();
        }

        if (tag === "SetThreshold") {
          const thresholdVal = vec[1];
          const threshold =
            thresholdVal.switch() === xdr.ScValType.scvU32()
              ? thresholdVal.u32()
              : Number(scValToNative(thresholdVal));
          return {
            kind: "SetThreshold",
            threshold,
            summary: `Set threshold to ${threshold}`,
          };
        }

        if (tag === "RotateSigners") {
          const signersVal = vec[1];
          let signers: string[] = [];
          if (signersVal.switch() === xdr.ScValType.scvVec()) {
            signers = (signersVal.vec() || []).map((s: any) => {
              if (s.switch() === xdr.ScValType.scvAddress()) {
                return Address.fromScVal(s).toString();
              }
              return String(scValToNative(s));
            });
          } else {
            const native = scValToNative(signersVal);
            if (Array.isArray(native)) signers = native.map(String);
          }
          const summary = `Rotate signers to ${signers.length} signers (${signers.map((s) => shortenAddress(s)).join(", ")})`;
          return {
            kind: "RotateSigners",
            signers,
            summary,
          };
        }

        if (tag === "InvokeContract" && vec.length >= 4) {
          const contractVal = vec[1];
          const funcVal = vec[2];
          const argsVal = vec[3];

          let contract = "";
          if (contractVal.switch() === xdr.ScValType.scvAddress()) {
            contract = Address.fromScVal(contractVal).toString();
          } else {
            contract = String(scValToNative(contractVal));
          }

          let functionName = "";
          if (funcVal.switch() === xdr.ScValType.scvSymbol()) {
            functionName = funcVal.sym().toString();
          } else {
            functionName = String(scValToNative(funcVal));
          }

          let args: DecodedVal[] = [];
          if (argsVal.switch() === xdr.ScValType.scvVec()) {
            args = (argsVal.vec() || []).map(decodeScVal);
          } else {
            const nativeArgs = scValToNative(argsVal);
            if (Array.isArray(nativeArgs)) {
              args = nativeArgs.map(decodeScVal);
            }
          }

          const argsSummary = args.map((a) => a.formatted).join(", ");
          const summary = `Invoke ${functionName} on ${shortenAddress(contract)} with args (${argsSummary})`;

          return {
            kind: "InvokeContract",
            contract,
            functionName,
            args,
            summary,
          };
        }
      }

      return {
        kind: "Unknown",
        raw: action,
        summary: "Unknown action format",
      };
    }

    // 2. Native Array / Tuple representation (e.g. ['SetThreshold', 2])
    if (Array.isArray(action) && action.length >= 2) {
      const tag = String(action[0]);
      if (tag === "SetThreshold") {
        const threshold = Number(action[1]);
        return {
          kind: "SetThreshold",
          threshold,
          summary: `Set threshold to ${threshold}`,
        };
      }
      if (tag === "RotateSigners") {
        const signers = Array.isArray(action[1]) ? action[1].map(String) : [];
        const summary = `Rotate signers to ${signers.length} signers (${signers.map((s) => shortenAddress(s)).join(", ")})`;
        return {
          kind: "RotateSigners",
          signers,
          summary,
        };
      }
      if (tag === "InvokeContract" && action.length >= 4) {
        const contract = String(action[1]);
        const functionName = String(action[2]);
        const rawArgs = Array.isArray(action[3]) ? action[3] : [];
        const args = rawArgs.map(decodeScVal);
        const argsSummary = args.map((a) => a.formatted).join(", ");
        const summary = `Invoke ${functionName} on ${shortenAddress(contract)} with args (${argsSummary})`;
        return {
          kind: "InvokeContract",
          contract,
          functionName,
          args,
          summary,
        };
      }
    }

    // 3. Native Object representation (e.g. { SetThreshold: 2 })
    if (typeof action === "object" && action !== null) {
      if ("SetThreshold" in action) {
        const threshold = Number((action as any).SetThreshold);
        return {
          kind: "SetThreshold",
          threshold,
          summary: `Set threshold to ${threshold}`,
        };
      }
      if ("RotateSigners" in action) {
        const raw = (action as any).RotateSigners;
        const signers = Array.isArray(raw) ? raw.map(String) : [];
        const summary = `Rotate signers to ${signers.length} signers (${signers.map((s) => shortenAddress(s)).join(", ")})`;
        return {
          kind: "RotateSigners",
          signers,
          summary,
        };
      }
      if ("InvokeContract" in action) {
        const raw = (action as any).InvokeContract;
        if (Array.isArray(raw) && raw.length >= 3) {
          const contract = String(raw[0]);
          const functionName = String(raw[1]);
          const rawArgs = Array.isArray(raw[2]) ? raw[2] : [];
          const args = rawArgs.map(decodeScVal);
          const argsSummary = args.map((a) => a.formatted).join(", ");
          const summary = `Invoke ${functionName} on ${shortenAddress(contract)} with args (${argsSummary})`;
          return {
            kind: "InvokeContract",
            contract,
            functionName,
            args,
            summary,
          };
        }
      }
      if (action.kind && action.summary) {
        return action as DecodedProposalAction;
      }
    }

    // 4. String fallback
    if (typeof action === "string") {
      return {
        kind: "Unknown",
        raw: action,
        summary: action,
      };
    }
  } catch (err) {
    return {
      kind: "Unknown",
      raw: action,
      summary: `Failed to decode action: ${String(err)}`,
    };
  }

  return {
    kind: "Unknown",
    raw: action,
    summary: "Unknown action",
  };
}
