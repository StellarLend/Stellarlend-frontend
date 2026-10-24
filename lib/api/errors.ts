/** Raised when the lending contract ID is missing from the server config. */
export class ContractNotConfiguredError extends Error {
  constructor() {
    super("Lending contract is not configured");
    this.name = "ContractNotConfiguredError";
  }
}

/** Raised when Soroban RPC cannot be reached or returns an unusable result. */
export class UpstreamRpcError extends Error {
  constructor(message = "Failed to read from Soroban RPC") {
    super(message);
    this.name = "UpstreamRpcError";
  }
}
