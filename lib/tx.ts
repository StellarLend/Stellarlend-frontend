import {
  rpc,
  TransactionBuilder,
  Operation,
  Account,
  xdr,
} from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";
import { config } from "./config";
import { decodeContractError } from "./errors/decode";

export interface TxSubmitOptions {
  signerAddress: string;
  contractId?: string;
  rpcUrl?: string;
  networkPassphrase?: string;
  freighterSigner?: (
    txXdr: string,
    opts?: { network?: string; networkPassphrase?: string }
  ) => Promise<string | { error?: string; signedTxXdr?: string }>;
  customRpcServer?: rpc.Server;
  verifyCallerRole?: () => Promise<void>;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

export function getRpcServer(custom?: rpc.Server, rpcUrl?: string): rpc.Server {
  return custom || new rpc.Server(rpcUrl || config.rpc);
}

/**
 * Polls for transaction confirmation using getTransaction until SUCCESS, FAILED, or timeout.
 */
export async function pollTransactionStatus(
  txHash: string,
  rpcServer: rpc.Server = getRpcServer(),
  pollIntervalMs = 1500,
  timeoutMs = 60000
): Promise<rpc.Api.GetTransactionResponse> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const tx = await rpcServer.getTransaction(txHash);
    if (tx.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return tx;
    }
    if (tx.status === rpc.Api.GetTransactionStatus.FAILED) {
      const errorDetail = tx.resultXdr?.toXDR("base64") || "Transaction execution failed";
      throw new Error(`Transaction failed on-chain: ${errorDetail}`);
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  throw new Error(`Transaction timed out while waiting for confirmation: ${txHash}`);
}

/**
 * Executes a Soroban write invocation with pre-signing role verification,
 * simulation, Freighter signing, submission to RPC, and confirmation polling.
 */
export async function executeContractCall(
  functionName: string,
  args: xdr.ScVal[],
  options: TxSubmitOptions
): Promise<{ txHash: string; status: "confirmed"; result?: rpc.Api.GetTransactionResponse }> {
  const contractId = options.contractId || config.lendingId;
  const networkPassphrase =
    options.networkPassphrase ||
    config.networkPassphrase ||
    "Test SDF Network ; September 2015";
  const rpcServer = getRpcServer(options.customRpcServer, options.rpcUrl);
  const freighter = options.freighterSigner || signTransaction;

  if (!contractId) {
    throw new Error("Missing contract ID configuration.");
  }

  // 1. Re-verify caller role before signing if a verifier is provided
  if (options.verifyCallerRole) {
    await options.verifyCallerRole();
  }

  // 2. Fetch current source account sequence
  const accountRes = await rpcServer.getAccount(options.signerAddress).catch(() => ({
    sequence: "1",
  }));

  const sourceAccount = new Account(
    options.signerAddress,
    (accountRes as any).sequence || "1"
  );

  const tx = new TransactionBuilder(sourceAccount, {
    fee: "100",
    networkPassphrase,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contractId,
        function: functionName,
        args,
      })
    )
    .setTimeout(60)
    .build();

  // 3. Simulate transaction
  let simulated = await rpcServer.simulateTransaction(tx);
  if ((simulated as any)?.transactionData && !(simulated as any)?._parsed) {
    simulated = rpc.parseRawSimulation(simulated as any);
  }
  if (!rpc.Api.isSimulationSuccess(simulated)) {
    const errMsg = simulated.error || "Contract simulation failed.";
    const decoded = decodeContractError(errMsg);
    throw new Error(decoded.message || errMsg);
  }

  // 4. Assemble prepared transaction
  const preparedTx = rpc.assembleTransaction(tx, simulated).build();

  // 5. Request Freighter signature
  let signRes: any;
  try {
    let txXdr: string;
    try {
      txXdr = preparedTx.toXDR();
    } catch {
      txXdr = preparedTx.toEnvelope().toXDR("base64");
    }
    signRes = await freighter(txXdr, {
      networkPassphrase,
    });
  } catch (err) {
    const decoded = decodeContractError(err);
    throw new Error(decoded.message || "Failed to sign transaction with Freighter.");
  }

  if (!signRes || signRes.error) {
    const rawError = signRes?.error || "Transaction signature declined by user.";
    const decoded = decodeContractError(rawError);
    throw new Error(decoded.message || rawError);
  }

  const signedXdr = typeof signRes === "string" ? signRes : signRes.signedTxXdr;
  if (!signedXdr) {
    throw new Error("No signed transaction XDR returned by Freighter.");
  }

  // 6. Submit to network
  // Pass an object with toXdr() to avoid jsdom Uint8Array cross-realm deserialization quirks
  const sendRes = await rpcServer.sendTransaction({
    toXdr: () => signedXdr,
  } as any);

  if (sendRes.status === "ERROR") {
    const errText = sendRes.errorResult?.toXDR("base64") || "Submission rejected";
    const decoded = decodeContractError(errText);
    throw new Error(decoded.message || errText);
  }

  // 7. Poll confirmation
  const confirmedTx = await pollTransactionStatus(
    sendRes.hash,
    rpcServer,
    options.pollIntervalMs,
    options.timeoutMs
  );

  return { txHash: sendRes.hash, status: "confirmed", result: confirmedTx };
}
