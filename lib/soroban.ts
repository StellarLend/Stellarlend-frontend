import {
  rpc,
  TransactionBuilder,
  Operation,
  Account,
  xdr,
  scValToNative,
} from "@stellar/stellar-sdk";
import { config } from "./config";

export interface SimulateReadOptions {
  rpcUrl?: string;
  customRpcServer?: rpc.Server;
  networkPassphrase?: string;
}

export interface SimulateReadResult<T = any> {
  result: xdr.ScVal | null;
  native: T | null;
  raw: rpc.Api.SimulateTransactionResponse;
}

export function getRpcServer(custom?: rpc.Server, rpcUrl?: string): rpc.Server {
  return custom || new rpc.Server(rpcUrl || config.rpc);
}

/**
 * Generic helper to simulate a read-only contract call on Soroban RPC (no signature, no fee).
 * Reusable across multisig and other protocol features.
 */
export async function simulateRead<T = any>(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
  options: SimulateReadOptions = {}
): Promise<SimulateReadResult<T>> {
  if (!contractId) {
    throw new Error("Contract ID is required for simulateRead");
  }

  const rpcServer = getRpcServer(options.customRpcServer, options.rpcUrl);
  const networkPassphrase =
    options.networkPassphrase ||
    config.networkPassphrase ||
    "Test SDF Network ; September 2015";

  // Build simulated transaction using a dummy source account
  const dummyAccount = new Account(
    "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    "0"
  );

  const tx = new TransactionBuilder(dummyAccount, {
    fee: "100",
    networkPassphrase,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contractId,
        function: method,
        args,
      })
    )
    .setTimeout(30)
    .build();

  const res = await rpcServer.simulateTransaction(tx);

  if (rpc.Api.isSimulationSuccess(res) && res.result?.retval) {
    const retval = res.result.retval;
    let native: T | null = null;
    try {
      native = scValToNative(retval) as T;
    } catch {
      native = null;
    }
    return {
      result: retval,
      native,
      raw: res,
    };
  }

  const errorString =
    (res as any).error ||
    (res.result?.retval
      ? "Simulation failed"
      : "Simulation returned error or no retval");
  throw new Error(`Simulation error for ${method}: ${errorString}`);
}
