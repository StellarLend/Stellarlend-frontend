import { StrKey } from "@stellar/stellar-sdk";

/** Returns true only for a valid Stellar ed25519 public key (G-address). */
export function isValidGAddress(address: string): boolean {
  if (typeof address !== "string") return false;
  return StrKey.isValidEd25519PublicKey(address);
}
