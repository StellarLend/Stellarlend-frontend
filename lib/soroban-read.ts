import {
  Account,
  BASE_FEE,
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";

const DEFAULT_RPC_URL = "https://soroban-testnet.stellar.org";

export function getSorobanRpcUrl(): string {
  return process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || DEFAULT_RPC_URL;
}

export function getNetworkPassphrase(): string {
  const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK;
  return network === "mainnet" || network === "public"
    ? Networks.PUBLIC
    : Networks.TESTNET;
}

/**
 * Generic read-only contract call: builds an invokeHostFunction transaction for
 * a throwaway source account and runs it through simulateTransaction.
 * Nothing is signed and no fee is paid.
 */
export async function simulateContractRead(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<unknown> {
  const url = getSorobanRpcUrl();
  const server = new rpc.Server(url, { allowHttp: url.startsWith("http://") });
  const source = new Account(Keypair.random().publicKey(), "0");

  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();

  const simulation = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Simulation of ${method} failed: ${simulation.error}`);
  }
  const retval = simulation.result?.retval;
  if (!retval) {
    throw new Error(`${method} returned no value`);
  }
  return scValToNative(retval);
}