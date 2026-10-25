import { describe, expect, it } from "vitest";
import {
  getExpectedNetworkPassphrase,
  isNetworkMismatch,
  NetworkMismatchError,
  NETWORK_PASSPHRASES,
  config,
} from "./config";

describe("network config and passphrase mapping", () => {
  it("maps known networks to their SDF passphrases", () => {
    expect(NETWORK_PASSPHRASES.testnet).toBe("Test SDF Network ; September 2015");
    expect(NETWORK_PASSPHRASES.public).toBe("Public Global Stellar Network ; September 2015");
    expect(NETWORK_PASSPHRASES.mainnet).toBe("Public Global Stellar Network ; September 2015");
    expect(NETWORK_PASSPHRASES.futurenet).toBe("Test SDF Future Network ; October 2022");
    expect(NETWORK_PASSPHRASES.standalone).toBe("Standalone Network ; February 2017");
  });

  it("getExpectedNetworkPassphrase returns configured passphrase or defaults based on network", () => {
    const defaultPassphrase = getExpectedNetworkPassphrase();
    expect(defaultPassphrase).toBe(config.networkPassphrase || NETWORK_PASSPHRASES.testnet);

    expect(getExpectedNetworkPassphrase("public")).toBe(NETWORK_PASSPHRASES.public);
    expect(getExpectedNetworkPassphrase("testnet")).toBe(NETWORK_PASSPHRASES.testnet);
    expect(getExpectedNetworkPassphrase("futurenet")).toBe(NETWORK_PASSPHRASES.futurenet);
  });

  it("isNetworkMismatch correctly flags different passphrases", () => {
    const expected = NETWORK_PASSPHRASES.testnet;

    // Same passphrase is not a mismatch
    expect(isNetworkMismatch(NETWORK_PASSPHRASES.testnet, expected)).toBe(false);

    // Public/mainnet on testnet configuration is a mismatch
    expect(isNetworkMismatch(NETWORK_PASSPHRASES.public, expected)).toBe(true);

    // Futurenet on testnet configuration is a mismatch
    expect(isNetworkMismatch(NETWORK_PASSPHRASES.futurenet, expected)).toBe(true);

    // Null or undefined current passphrase (e.g. not connected yet) is not treated as mismatch
    expect(isNetworkMismatch(null, expected)).toBe(false);
    expect(isNetworkMismatch(undefined, expected)).toBe(false);
  });

  it("NetworkMismatchError encapsulates passphrase info and prototype correctly", () => {
    const error = new NetworkMismatchError(NETWORK_PASSPHRASES.public, NETWORK_PASSPHRASES.testnet);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(NetworkMismatchError);
    expect(error.name).toBe("NetworkMismatchError");
    expect(error.currentPassphrase).toBe(NETWORK_PASSPHRASES.public);
    expect(error.expectedPassphrase).toBe(NETWORK_PASSPHRASES.testnet);
    expect(error.message).toContain("does not match");
  });
});
