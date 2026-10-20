import { Proposal } from "./types";

export const INITIAL_PROPOSALS: Proposal[] = [
  {
    id: 1,
    proposer: "GBSRKAMUOPCLSN75TJLM52HF55R6KOH7PMSA4XDNPXXNBDWBTLMPJEOI",
    action: "Update LTV ratio for XLM market to 75%",
    status: "Active",
    payloadHash: "4a5b6c7d8e9f0123456789abcdef0123456789abcdef0123456789abcdef0123",
    approvals: ["GBSRKAMUOPCLSN75TJLM52HF55R6KOH7PMSA4XDNPXXNBDWBTLMPJEOI"],
    signerSetHash: "0000000000000000000000000000000000000000000000000000000000000001",
    expiresAtLedger: 1250000,
    threshold: 2,
    totalSigners: 3,
  },
  {
    id: 2,
    proposer: "GBSXPC5X665CKCIUMUHLAKVRQNYA5XCNIWV2Q3QVUNLIVL7IJIQWTSFG",
    action: "Adjust USDC reserve interest rate slope to 4%",
    status: "Passed",
    payloadHash: "123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0",
    approvals: [
      "GBSRKAMUOPCLSN75TJLM52HF55R6KOH7PMSA4XDNPXXNBDWBTLMPJEOI",
      "GBSXPC5X665CKCIUMUHLAKVRQNYA5XCNIWV2Q3QVUNLIVL7IJIQWTSFG",
    ],
    signerSetHash: "0000000000000000000000000000000000000000000000000000000000000001",
    expiresAtLedger: 1260000,
    threshold: 2,
    totalSigners: 3,
  },
  {
    id: 3,
    proposer: "GCM77ERDWXR7IR53PQ2JMH2IKNFR5GWVGBIENALKSOQOPPWH5CN2E6S7",
    action: "Upgrade lending pool oracle adapter to v1.2",
    status: "Executed",
    payloadHash: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
    approvals: [
      "GBSRKAMUOPCLSN75TJLM52HF55R6KOH7PMSA4XDNPXXNBDWBTLMPJEOI",
      "GCM77ERDWXR7IR53PQ2JMH2IKNFR5GWVGBIENALKSOQOPPWH5CN2E6S7",
    ],
    signerSetHash: "0000000000000000000000000000000000000000000000000000000000000001",
    expiresAtLedger: 1240000,
    threshold: 2,
    totalSigners: 3,
  },
];

const LOCAL_STORAGE_KEY = "stellarlend_multisig_proposals";

export function getProposals(): Proposal[] {
  if (typeof window === "undefined") return INITIAL_PROPOSALS;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_PROPOSALS));
      return INITIAL_PROPOSALS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_PROPOSALS;
  }
}

export function saveProposals(proposals: Proposal[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(proposals));
  } catch {}
}
