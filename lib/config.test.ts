import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { Networks } from "@stellar/stellar-sdk";
import {
  createExplorerHelpers,
  parseEnvFile,
  validateConfig,
} from "./config";

describe("validateConfig", () => {
  const validTestnetEnv = {
    NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
    NEXT_PUBLIC_HORIZON_URL: "https://horizon-testnet.stellar.org",
    NEXT_PUBLIC_SOROBAN_RPC_URL: "https://soroban-testnet.stellar.org",
    NEXT_PUBLIC_LENDING_CONTRACT_ID: "CC4A6A46O2KQA7KEMOFK3TQ4YRSLCJ4ZP26SQWXIKNF4DTEX3BOL2HF6",
  };

  it("validates a standard valid testnet config", () => {
    const config = validateConfig(validTestnetEnv, { isDev: false });
    expect(config.network).toBe("testnet");
    expect(config.networkPassphrase).toBe(Networks.TESTNET);
    expect(config.horizon).toBe("https://horizon-testnet.stellar.org");
    expect(config.rpc).toBe("https://soroban-testnet.stellar.org");
    expect(config.lendingId).toBe("CC4A6A46O2KQA7KEMOFK3TQ4YRSLCJ4ZP26SQWXIKNF4DTEX3BOL2HF6");
  });

  it("derives mainnet passphrase and explorer URLs", () => {
    const mainnetEnv = {
      ...validTestnetEnv,
      NEXT_PUBLIC_STELLAR_NETWORK: "mainnet",
      NEXT_PUBLIC_HORIZON_URL: "https://horizon.stellar.org",
      NEXT_PUBLIC_SOROBAN_RPC_URL: "https://soroban-rpc.mainnet.stellar.org",
    };
    const config = validateConfig(mainnetEnv, { isDev: false });
    expect(config.network).toBe("mainnet");
    expect(config.networkPassphrase).toBe(Networks.PUBLIC);

    const explorer = createExplorerHelpers(config.network);
    const contractId = "CC4A6A46O2KQA7KEMOFK3TQ4YRSLCJ4ZP26SQWXIKNF4DTEX3BOL2HF6";
    expect(explorer(contractId)).toBe(`https://stellar.expert/explorer/public/contract/${contractId}`);
    expect(explorer.contract(contractId)).toBe(`https://stellar.expert/explorer/public/contract/${contractId}`);
    expect(explorer.tx("hash123")).toBe("https://stellar.expert/explorer/public/tx/hash123");
    expect(explorer.account("GB...ADDRESS")).toBe("https://stellar.expert/explorer/public/account/GB...ADDRESS");
  });

  it("derives futurenet passphrase and explorer URLs", () => {
    const futurenetEnv = {
      ...validTestnetEnv,
      NEXT_PUBLIC_STELLAR_NETWORK: "futurenet",
      NEXT_PUBLIC_HORIZON_URL: "https://horizon-futurenet.stellar.org",
      NEXT_PUBLIC_SOROBAN_RPC_URL: "https://rpc-futurenet.stellar.org",
    };
    const config = validateConfig(futurenetEnv, { isDev: false });
    expect(config.network).toBe("futurenet");
    expect(config.networkPassphrase).toBe(Networks.FUTURENET);

    const explorer = createExplorerHelpers(config.network);
    expect(explorer.tx("hash456")).toBe("https://stellar.expert/explorer/futurenet/tx/hash456");
  });

  it("rejects unknown network foo", () => {
    const badEnv = {
      ...validTestnetEnv,
      NEXT_PUBLIC_STELLAR_NETWORK: "foo",
    };
    expect(() => validateConfig(badEnv, { isDev: false })).toThrowError(/NEXT_PUBLIC_STELLAR_NETWORK/);
  });

  it("rejects contract ID with bad checksum", () => {
    const badEnv = {
      ...validTestnetEnv,
      // Modify last character so checksum fails
      NEXT_PUBLIC_LENDING_CONTRACT_ID: "CC4A6A46O2KQA7KEMOFK3TQ4YRSLCJ4ZP26SQWXIKNF4DTEX3BOL2HF7",
    };
    expect(() => validateConfig(badEnv, { isDev: false })).toThrowError(
      /NEXT_PUBLIC_LENDING_CONTRACT_ID.*must be a valid C\.\.\. Soroban contract address/
    );
  });

  it("rejects G-address passed where contract C-address expected", () => {
    const badEnv = {
      ...validTestnetEnv,
      NEXT_PUBLIC_LENDING_CONTRACT_ID: "GBBM6BKZPEHWYO3E3YKREDPQXMS4VK35YLNU7VEFBCompactSample",
    };
    expect(() => validateConfig(badEnv, { isDev: false })).toThrowError(
      /NEXT_PUBLIC_LENDING_CONTRACT_ID.*must be a valid C\.\.\. Soroban contract address/
    );
  });

  it("rejects http URLs in production", () => {
    const httpEnv = {
      ...validTestnetEnv,
      NEXT_PUBLIC_HORIZON_URL: "http://horizon-testnet.stellar.org",
    };
    expect(() => validateConfig(httpEnv, { isDev: false })).toThrowError(
      /NEXT_PUBLIC_HORIZON_URL must be a valid https URL/
    );
  });

  it("allows localhost http URLs in development mode", () => {
    const devEnv = {
      ...validTestnetEnv,
      NEXT_PUBLIC_HORIZON_URL: "http://localhost:8000",
      NEXT_PUBLIC_SOROBAN_RPC_URL: "http://127.0.0.1:8000/soroban/rpc",
    };
    const config = validateConfig(devEnv, { isDev: true });
    expect(config.horizon).toBe("http://localhost:8000");
    expect(config.rpc).toBe("http://127.0.0.1:8000/soroban/rpc");
  });

  it("rejects non-localhost http URLs in development mode", () => {
    const devEnv = {
      ...validTestnetEnv,
      NEXT_PUBLIC_HORIZON_URL: "http://example.com:8000",
    };
    expect(() => validateConfig(devEnv, { isDev: true })).toThrowError(
      /NEXT_PUBLIC_HORIZON_URL must be a valid https URL/
    );
  });

  it("allows empty optional contract IDs", () => {
    const emptyOptionalEnv = {
      ...validTestnetEnv,
      NEXT_PUBLIC_LENDING_CONTRACT_ID: "",
      NEXT_PUBLIC_AMM_CONTRACT_ID: "",
    };
    const config = validateConfig(emptyOptionalEnv, { isDev: false });
    expect(config.lendingId).toBe("");
    expect(config.ammId).toBe("");
  });

  it("normalises trailing slashes in URLs", () => {
    const trailingSlashEnv = {
      ...validTestnetEnv,
      NEXT_PUBLIC_HORIZON_URL: "https://horizon-testnet.stellar.org///",
      NEXT_PUBLIC_SOROBAN_RPC_URL: "https://soroban-testnet.stellar.org/",
    };
    const config = validateConfig(trailingSlashEnv, { isDev: false });
    expect(config.horizon).toBe("https://horizon-testnet.stellar.org");
    expect(config.rpc).toBe("https://soroban-testnet.stellar.org");
  });

  it("parses and validates .env.example", () => {
    const envPath = resolve(__dirname, "../.env.example");
    const content = readFileSync(envPath, "utf-8");
    const parsed = parseEnvFile(content);

    const config = validateConfig(parsed, { isDev: false });
    expect(config.network).toBe("testnet");
    expect(config.networkPassphrase).toBe(Networks.TESTNET);
    expect(config.lendingId).toBe("CC4A6A46O2KQA7KEMOFK3TQ4YRSLCJ4ZP26SQWXIKNF4DTEX3BOL2HF6");
    expect(config.horizon).toBe("https://horizon-testnet.stellar.org");
    expect(config.rpc).toBe("https://soroban-testnet.stellar.org");
  });
});
