import {
  rpc,
  TransactionBuilder,
  Operation,
  Account,
  Address,
  nativeToScVal,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import { signTransaction } from '@stellar/freighter-api';
import { config } from '../config';
import { computeApprovalBindingHash, verifyAuthEntryBinding } from './binding';
import { parseMultisigError, Proposal } from './types';

export interface ActionOptions {
  signerAddress: string;
  contractId?: string;
  rpcUrl?: string;
  networkPassphrase?: string;
  signerSetHash?: string;
  freighterSigner?: typeof signTransaction;
  customRpcServer?: rpc.Server;
  simulatedAuthEntries?: any[]; // for testing
  knownSigners?: string[];
}

export function getRpcServer(custom?: rpc.Server, rpcUrl?: string): rpc.Server {
  return custom || new rpc.Server(rpcUrl || config.rpc);
}

/**
 * Reads get_signers() from the multisig contract on-chain.
 */
export async function getSigners(
  contractId: string = config.multisigId || config.lendingId,
  rpcServer: rpc.Server = getRpcServer()
): Promise<string[]> {
  if (!contractId) return [];
  try {
    const tx = new TransactionBuilder(
      new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0'),
      {
        fee: '100',
        networkPassphrase: config.networkPassphrase || 'Test SDF Network ; September 2015',
      }
    )
      .addOperation(
        Operation.invokeContractFunction({
          contract: contractId,
          function: 'get_signers',
          args: [],
        })
      )
      .setTimeout(30)
      .build();

    const res = await rpcServer.simulateTransaction(tx);
    if (rpc.Api.isSimulationSuccess(res) && res.result?.retval) {
      const native = scValToNative(res.result.retval);
      if (Array.isArray(native)) {
        return native.map((s) => String(s));
      }
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Reads get_proposal_signer_set_hash() from the multisig contract on-chain.
 */
export async function getProposalSignerSetHash(
  proposalId: number | bigint,
  contractId: string = config.multisigId || config.lendingId,
  rpcServer: rpc.Server = getRpcServer()
): Promise<string | null> {
  if (!contractId) return null;
  try {
    const tx = new TransactionBuilder(
      new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0'),
      {
        fee: '100',
        networkPassphrase: config.networkPassphrase || 'Test SDF Network ; September 2015',
      }
    )
      .addOperation(
        Operation.invokeContractFunction({
          contract: contractId,
          function: 'get_proposal_signer_set_hash',
          args: [nativeToScVal(BigInt(proposalId), { type: 'u64' })],
        })
      )
      .setTimeout(30)
      .build();

    const res = await rpcServer.simulateTransaction(tx);
    if (rpc.Api.isSimulationSuccess(res) && res.result?.retval) {
      const native = scValToNative(res.result.retval);
      if (Buffer.isBuffer(native) || native instanceof Uint8Array) {
        return Buffer.from(native).toString('hex');
      }
      return String(native);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Reads get_proposal() from the multisig contract on-chain.
 */
export async function getProposal(
  proposalId: number | bigint,
  contractId: string = config.multisigId || config.lendingId,
  rpcServer: rpc.Server = getRpcServer()
): Promise<Proposal | null> {
  if (!contractId) return null;
  try {
    const tx = new TransactionBuilder(
      new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0'),
      {
        fee: '100',
        networkPassphrase: config.networkPassphrase || 'Test SDF Network ; September 2015',
      }
    )
      .addOperation(
        Operation.invokeContractFunction({
          contract: contractId,
          function: 'get_proposal',
          args: [nativeToScVal(BigInt(proposalId), { type: 'u64' })],
        })
      )
      .setTimeout(30)
      .build();

    const res = await rpcServer.simulateTransaction(tx);
    if (rpc.Api.isSimulationSuccess(res) && res.result?.retval) {
      const native = scValToNative(res.result.retval);
      return native as Proposal;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Verifies whether an address is an active registered signer.
 */
export async function isSigner(
  address: string,
  contractId: string = (config as any).multisigId || config.lendingId,
  rpcServer: rpc.Server = getRpcServer()
): Promise<boolean> {
  const signers = await getSigners(contractId, rpcServer);
  return signers.includes(address);
}

/**
 * Polls Soroban getTransaction until SUCCESS or FAILED with a timeout.
 */
export async function pollTransactionStatus(
  txHash: string,
  rpcServer: rpc.Server = getRpcServer(),
  timeoutMs: number = 30000,
  pollIntervalMs: number = 2000
): Promise<rpc.Api.GetTransactionResponse> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const tx = await rpcServer.getTransaction(txHash);
    if (tx.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return tx;
    }
    if (tx.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(
        `Transaction failed on-chain: ${parseMultisigError(tx.resultXdr?.toXDR('base64') || 'Unknown execution failure')}`
      );
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  throw new Error(`Transaction timed out while waiting for confirmation: ${txHash}`);
}

/**
 * Executes the full Soroban write pipeline with simulation, domain-binding validation, Freighter signing, and confirmation.
 */
export async function executeMultisigWrite(
  method: string,
  args: xdr.ScVal[],
  options: ActionOptions,
  bindingVerification?: { expectedBindingHash: Buffer }
): Promise<{ txHash: string; status: 'confirmed' }> {
  const contractId = options.contractId || (config as any).multisigId || config.lendingId;
  const networkPassphrase =
    options.networkPassphrase ||
    (config as any).networkPassphrase ||
    'Test SDF Network ; September 2015';
  const rpcServer = getRpcServer(options.customRpcServer, options.rpcUrl);
  const freighter = options.freighterSigner || signTransaction;

  // 1. Role verification right before signing
  const isAuthorized = options.knownSigners
    ? options.knownSigners.includes(options.signerAddress)
    : await isSigner(options.signerAddress, contractId, rpcServer);
  if (!isAuthorized) {
    throw new Error('Action blocked: connected address is not a registered multisig signer.');
  }

  // 2. Build invocation transaction
  const accountRes = await rpcServer.getAccount(options.signerAddress).catch(() => ({
    sequence: '1',
  }));

  const sourceAccount = new Account(options.signerAddress, (accountRes as any).sequence || '1');

  const tx = new TransactionBuilder(sourceAccount, {
    fee: '100',
    networkPassphrase,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contractId,
        function: method,
        args,
      })
    )
    .setTimeout(60)
    .build();

  // 3. Prepare and simulate
  let simulated = await rpcServer.simulateTransaction(tx);
  if ((simulated as any)?.transactionData && !(simulated as any)?._parsed) {
    simulated = rpc.parseRawSimulation(simulated as any);
  }
  if (!rpc.Api.isSimulationSuccess(simulated)) {
    const errMsg = parseMultisigError(simulated.error || 'Contract simulation failed.');
    throw new Error(errMsg);
  }

  // 4. Domain-bound auth check for approve_proposal
  if (bindingVerification) {
    const authEntries = options.simulatedAuthEntries || simulated.result?.auth || [];
    const hasValidBinding = authEntries.some((entry: any) =>
      verifyAuthEntryBinding(entry, bindingVerification.expectedBindingHash)
    );

    if (!hasValidBinding) {
      throw new Error(
        'Approval binding mismatch: simulated authorization does not match the expected domain binding hash. Signing aborted for security.'
      );
    }
  }

  // 5. Assemble prepared transaction
  const preparedTx = rpc.assembleTransaction(tx, simulated).build();

  // 6. Request Freighter signature
  const signRes = await freighter(preparedTx.toXDR(), {
    networkPassphrase,
  });

  if (!signRes || (signRes as any).error) {
    throw new Error((signRes as any)?.error || 'Transaction signature declined by user.');
  }

  const signedXdr = typeof signRes === 'string' ? signRes : (signRes as any).signedTxXdr;

  // 7. Submit to network
  const sendRes = await rpcServer.sendTransaction(
    TransactionBuilder.fromXDR(signedXdr, networkPassphrase) as any
  );

  if (sendRes.status === 'ERROR') {
    throw new Error(`Transaction submission rejected: ${sendRes.errorResult?.toXDR('base64') || 'Unknown error'}`);
  }

  // 8. Poll confirmation
  await pollTransactionStatus(sendRes.hash, rpcServer);

  return { txHash: sendRes.hash, status: 'confirmed' };
}

/**
 * Approves a multisig proposal with domain-bound authorization check.
 */
export async function approveProposal(
  proposalId: number,
  options: ActionOptions
): Promise<{ txHash: string; status: 'confirmed' }> {
  const contractId = options.contractId || config.multisigId || config.lendingId;
  const rpcServer = getRpcServer(options.customRpcServer, options.rpcUrl);

  // 1. Role check before any binding or proposal lookup
  const isAuthorized = options.knownSigners
    ? options.knownSigners.includes(options.signerAddress)
    : await isSigner(options.signerAddress, contractId, rpcServer);
  if (!isAuthorized) {
    throw new Error('Action blocked: connected address is not a registered multisig signer.');
  }

  let signerSetHash = options.signerSetHash;
  if (!signerSetHash) {
    try {
      const fetched = await getProposalSignerSetHash(proposalId, contractId, rpcServer);
      if (fetched && fetched.length === 64) {
        signerSetHash = fetched;
      }
    } catch {}
  }
  signerSetHash = signerSetHash || '0'.repeat(64);

  const expectedBindingHash = computeApprovalBindingHash(
    contractId,
    proposalId,
    options.signerAddress,
    signerSetHash
  );

  return executeMultisigWrite(
    'approve_proposal',
    [
      new Address(options.signerAddress).toScVal(),
      nativeToScVal(BigInt(proposalId), { type: 'u64' }),
    ],
    { ...options, knownSigners: [options.signerAddress] },
    { expectedBindingHash }
  );
}

/**
 * Executes a passed proposal.
 */
export async function executeProposal(
  proposalId: number,
  payloadHash: string,
  options: ActionOptions
): Promise<{ txHash: string; status: 'confirmed' }> {
  const payloadHashBytes = Buffer.from(payloadHash.replace(/^0x/, ''), 'hex');

  return executeMultisigWrite(
    'execute_proposal',
    [
      new Address(options.signerAddress).toScVal(),
      nativeToScVal(BigInt(proposalId), { type: 'u64' }),
      xdr.ScVal.scvBytes(new Uint8Array(payloadHashBytes)),
    ],
    options
  );
}

/**
 * Batch-executes up to 32 passed proposals atomically.
 */
export async function batchExecuteProposals(
  proposalIds: number[],
  payloadHashes: string[],
  options: ActionOptions
): Promise<{ txHash: string; status: 'confirmed' }> {
  if (proposalIds.length === 0) {
    throw new Error('No proposals selected for batch execution.');
  }
  if (proposalIds.length > 32) {
    throw new Error('Batch size exceeds maximum limit of 32 proposals.');
  }
  if (proposalIds.length !== payloadHashes.length) {
    throw new Error('Mismatch between proposal IDs and payload hashes count.');
  }

  const idsScVal = xdr.ScVal.scvVec(
    proposalIds.map((id) => nativeToScVal(BigInt(id), { type: 'u64' }))
  );
  const hashesScVal = xdr.ScVal.scvVec(
    payloadHashes.map((h) =>
      xdr.ScVal.scvBytes(new Uint8Array(Buffer.from(h.replace(/^0x/, ''), 'hex')))
    )
  );

  return executeMultisigWrite(
    'batch_execute',
    [
      new Address(options.signerAddress).toScVal(),
      idsScVal,
      hashesScVal,
    ],
    options
  );
}

/**
 * Cancels a proposal.
 */
export async function cancelProposal(
  proposalId: number,
  options: ActionOptions
): Promise<{ txHash: string; status: 'confirmed' }> {
  return executeMultisigWrite(
    'cancel_proposal',
    [
      new Address(options.signerAddress).toScVal(),
      nativeToScVal(BigInt(proposalId), { type: 'u64' }),
    ],
    options
  );
}
