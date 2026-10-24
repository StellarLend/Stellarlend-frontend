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

// ---------------------------------------------------------------------------
// Liquidation flow (from main)
// ---------------------------------------------------------------------------


export interface LiquidateTransactionParams {
  liquidator: string;
  borrower: string;
  debtAsset: string;
  collateralAsset: string;
  amount: bigint;
  contractId: string;
}

export interface TransactionResult {
  hash: string;
  status: 'success' | 'failed';
  error?: string;
}

/**
 * Builds a liquidate transaction instruction in the JSON-RPC format.
 */
function buildLiquidateInstruction(params: LiquidateTransactionParams): Record<string, unknown> {
  const { liquidator, borrower, debtAsset, collateralAsset, amount, contractId } = params;

  return {
    type: 'invoke_host_function',
    function: 'liquidate',
    contract_id: contractId,
    args: [
      { type: 'address', value: liquidator },
      { type: 'address', value: borrower },
      { type: 'string', value: debtAsset },
      { type: 'string', value: collateralAsset },
      { type: 'i128', value: amount.toString() },
    ],
    footprint: {
      read_only: [],
      read_write: [],
    },
  };
}

/**
 * Builds a liquidate transaction via the server-side build endpoint.
 * Returns the unsigned XDR envelope.
 * Note: This is a simplified implementation. In production, use the Stellar SDK.
 */
export async function buildLiquidateTransaction(params: LiquidateTransactionParams): Promise<string> {
  // For now, return a mock XDR string
  // In production, this would call the Soroban RPC to build the transaction
  return 'mock_unsigned_xdr_' + params.liquidator + '_' + params.borrower;
}

/**
 * Signs a transaction XDR using Freighter wallet.
 * Returns the signed XDR envelope.
 * Note: This is a simplified implementation. In production, this uses actual Freighter.
 */
export async function signWithFreighter(unsignedXdr: string): Promise<string> {
  // For now, return a mock signed XDR
  // In production, this would use window.stellar.signTransaction()
  return 'mock_signed_xdr_' + unsignedXdr;
}

/**
 * Submits a signed transaction to the Soroban RPC.
 * Returns the transaction hash.
 * Note: This is a simplified implementation. In production, use actual RPC.
 */
export async function submitTransaction(signedXdr: string): Promise<string> {
  // For now, return a mock transaction hash
  // In production, this would submit to the Soroban RPC
  return 'test_tx_hash_' + Date.now();
}

/**
 * Polls for transaction status until it's confirmed or failed.
 * Note: This is a simplified implementation. In production, use actual RPC.
 */
async function pollLiquidationStatus(
  hash: string,
  maxAttempts: number = 30,
  intervalMs: number = 2000,
): Promise<TransactionResult> {
  // For now, immediately return success
  // In production, this would poll the Soroban RPC
  return { hash, status: 'success' };
}

/**
 * Complete liquidation flow: build, sign, submit, and poll.
 */
export async function executeLiquidation(
  params: LiquidateTransactionParams,
): Promise<TransactionResult> {
  // 1. Build the transaction
  const unsignedXdr = await buildLiquidateTransaction(params);

  // 2. Sign with Freighter
  const signedXdr = await signWithFreighter(unsignedXdr);

  // 3. Submit to network
  const hash = await submitTransaction(signedXdr);

  // 4. Poll for confirmation
  const result = await pollLiquidationStatus(hash);

  return result;
}

/**
 * Parses common contract errors from transaction results.
 */
export function parseContractError(error: unknown): string {
  if (typeof error === 'string') {
    if (error.includes('PositionHealthy')) {
      return 'Position is healthy and cannot be liquidated';
    }
    if (error.includes('SelfLiquidation')) {
      return 'Cannot liquidate your own position';
    }
    if (error.includes('StaleOracleTimestamp')) {
      return 'Oracle price data is stale; please try again later';
    }
    if (error.includes('OperationPaused')) {
      return 'Liquidation operations are currently paused';
    }
  }

  if (error instanceof Error) {
    return parseContractError(error.message);
  }

  return 'Unknown contract error';
}
