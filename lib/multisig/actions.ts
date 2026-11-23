import {
  rpc,
  TransactionBuilder,
  Operation,
  Account,
  Address,
  StrKey,
  nativeToScVal,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import { signTransaction } from '@stellar/freighter-api';
import { config, isValidContractAddress } from '../config';
import { toBaseUnits } from '../amount';
import { computeApprovalBindingHash, verifyAuthEntryBinding } from './binding';
import { extractProposalIdFromEvent } from './reads';
import { parseMultisigError, Proposal } from './types';
import {
  getRpcServer,
  pollTransactionStatus as pollSharedTransactionStatus,
} from '../rpc-tx';

export { getRpcServer };

export type ProposalActionType = 'InvokeContract' | 'SetThreshold' | 'RotateSigners';

export type InvokeContractArgInput =
  | { type: 'address'; value: string }
  | { type: 'amount'; value: string; decimals?: number }
  | { type: 'u32'; value: string | number }
  | { type: 'u64'; value: string | bigint | number }
  | { type: 'bool'; value: boolean }
  | { type: 'symbol'; value: string }
  | { type: 'string'; value: string };

export interface InvokeContractParams {
  contract: string;
  functionName: string;
  args?: InvokeContractArgInput[];
}

export interface SetThresholdParams {
  threshold: number | string;
}

export interface RotateSignersParams {
  signers: string[];
}

export type ProposalActionParams =
  | InvokeContractParams
  | SetThresholdParams
  | RotateSignersParams;

export interface CreateProposalResult {
  txHash: string;
  status: 'confirmed';
  proposalId: number | null;
}

/**
 * Validates whether a string is a valid Stellar G-address (Ed25519 public key).
 */
export function isValidGAddress(address?: string | null): boolean {
  if (!address || typeof address !== 'string') return false;
  const trimmed = address.trim();
  if (!/^G[A-Z0-9]{55}$/.test(trimmed)) return false;
  try {
    return StrKey.isValidEd25519PublicKey(trimmed);
  } catch {
    return false;
  }
}

/**
 * Validates whether a string is a valid Soroban Contract ID (C-address) or Stellar G-address.
 */
export function isValidStellarAddress(address?: string | null): boolean {
  return isValidContractAddress(address) || isValidGAddress(address);
}

function toUtf8Bytes(str: string): Uint8Array {
  return new Uint8Array(new TextEncoder().encode(str));
}

/**
 * Pure builder that validates proposal parameters and encodes a ProposalAction ScVal.
 */
export function buildProposalArgs(
  actionType: ProposalActionType,
  params: ProposalActionParams
): xdr.ScVal {
  if (actionType === 'SetThreshold') {
    const p = params as SetThresholdParams;
    const raw = typeof p?.threshold === 'string' ? p.threshold.trim() : p?.threshold;
    const threshold = typeof raw === 'number' ? raw : Number(raw);
    if (
      raw === '' ||
      raw === undefined ||
      raw === null ||
      !Number.isInteger(threshold) ||
      threshold < 1 ||
      threshold > 0xffffffff
    ) {
      throw new Error('Threshold must be a positive integer (u32 >= 1).');
    }
    return xdr.ScVal.scvVec([
      xdr.ScVal.scvSymbol(toUtf8Bytes('SetThreshold') as any),
      xdr.ScVal.scvU32(threshold),
    ]);
  }

  if (actionType === 'RotateSigners') {
    const p = params as RotateSignersParams;
    if (!Array.isArray(p?.signers) || p.signers.length === 0) {
      throw new Error('RotateSigners requires at least one valid Stellar G-address.');
    }
    const seen = new Set<string>();
    const encodedSigners: xdr.ScVal[] = [];
    for (const rawSigner of p.signers) {
      const signer = typeof rawSigner === 'string' ? rawSigner.trim() : '';
      if (!isValidGAddress(signer)) {
        throw new Error(`Invalid signer G-address: "${rawSigner}"`);
      }
      if (seen.has(signer)) {
        throw new Error(`Duplicate signer address: "${signer}"`);
      }
      seen.add(signer);
      encodedSigners.push(new Address(signer).toScVal());
    }
    return xdr.ScVal.scvVec([
      xdr.ScVal.scvSymbol(toUtf8Bytes('RotateSigners') as any),
      xdr.ScVal.scvVec(encodedSigners),
    ]);
  }

  if (actionType === 'InvokeContract') {
    const p = params as InvokeContractParams;
    const contract = typeof p?.contract === 'string' ? p.contract.trim() : '';
    if (!isValidContractAddress(contract)) {
      throw new Error(`Invalid contract address: "${p?.contract ?? ''}"`);
    }
    const functionName = typeof p?.functionName === 'string' ? p.functionName.trim() : '';
    if (!functionName || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(functionName)) {
      throw new Error('Function name must be a valid Soroban symbol (letters, digits, underscores).');
    }

    const encodedArgs: xdr.ScVal[] = (p.args ?? []).map((arg, idx) => {
      switch (arg.type) {
        case 'address': {
          const addr = typeof arg.value === 'string' ? arg.value.trim() : '';
          if (!isValidStellarAddress(addr)) {
            throw new Error(`Argument #${idx + 1}: invalid Stellar address "${arg.value}"`);
          }
          return new Address(addr).toScVal();
        }
        case 'amount': {
          const strVal = typeof arg.value === 'string' ? arg.value.trim() : '';
          const parsed = toBaseUnits(strVal, arg.decimals);
          if (!parsed.ok) {
            throw new Error(`Argument #${idx + 1}: invalid amount "${arg.value}" (${parsed.error})`);
          }
          return nativeToScVal(parsed.value, { type: 'i128' });
        }
        case 'u32': {
          const raw = typeof arg.value === 'string' ? arg.value.trim() : arg.value;
          const n = typeof raw === 'number' ? raw : Number(raw);
          if (raw === '' || !Number.isInteger(n) || n < 0 || n > 0xffffffff) {
            throw new Error(`Argument #${idx + 1}: invalid u32 "${arg.value}"`);
          }
          return xdr.ScVal.scvU32(n);
        }
        case 'u64': {
          const raw = typeof arg.value === 'string' ? arg.value.trim() : String(arg.value);
          if (!/^\d+$/.test(raw)) {
            throw new Error(`Argument #${idx + 1}: invalid u64 "${arg.value}"`);
          }
          const n = BigInt(raw);
          if (n < 0n || n > 0xffffffffffffffffn) {
            throw new Error(`Argument #${idx + 1}: u64 out of range "${arg.value}"`);
          }
          return nativeToScVal(n, { type: 'u64' });
        }
        case 'bool': {
          return xdr.ScVal.scvBool(Boolean(arg.value));
        }
        case 'symbol': {
          const sym = typeof arg.value === 'string' ? arg.value.trim() : '';
          if (!sym) {
            throw new Error(`Argument #${idx + 1}: symbol cannot be empty`);
          }
          return xdr.ScVal.scvSymbol(toUtf8Bytes(sym) as any);
        }
        case 'string': {
          return xdr.ScVal.scvString(toUtf8Bytes(String(arg.value ?? '')) as any);
        }
        default:
          throw new Error(`Argument #${idx + 1}: unsupported argument type`);
      }
    });

    return xdr.ScVal.scvVec([
      xdr.ScVal.scvSymbol(toUtf8Bytes('InvokeContract') as any),
      new Address(contract).toScVal(),
      xdr.ScVal.scvSymbol(toUtf8Bytes(functionName) as any),
      xdr.ScVal.scvVec(encodedArgs),
    ]);
  }

  throw new Error(`Unsupported proposal action type: "${String(actionType)}"`);
}

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
  return pollSharedTransactionStatus(txHash, {
    server: rpcServer,
    timeoutMs,
    intervalMs: pollIntervalMs,
    parseError: parseMultisigError,
  });
}

/**
 * Executes the full Soroban write pipeline with simulation, domain-binding validation, Freighter signing, and confirmation.
 */
export async function executeMultisigWrite(
  method: string,
  args: xdr.ScVal[],
  options: ActionOptions,
  bindingVerification?: { expectedBindingHash: Buffer }
): Promise<{ txHash: string; status: 'confirmed'; txResponse?: rpc.Api.GetTransactionResponse }> {
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
  const txResponse = await pollTransactionStatus(sendRes.hash, rpcServer);

  return { txHash: sendRes.hash, status: 'confirmed', txResponse };
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

/**
 * Extracts a newly created proposal ID from a confirmed Soroban transaction response.
 */
function extractProposalIdFromTxResponse(txResponse: any): number | null {
  if (!txResponse) return null;

  // 1. Check direct events array (standard RPC / mocked response)
  if (Array.isArray(txResponse.events)) {
    for (const ev of txResponse.events) {
      const id = extractProposalIdFromEvent(ev);
      if (id !== null && id > 0) return id;
    }
  }

  // 2. Check Soroban returnValue if present
  if (txResponse.returnValue) {
    const id = extractProposalIdFromEvent({ value: txResponse.returnValue });
    if (id !== null && id > 0) return id;
  }

  return null;
}

/**
 * Creates a new multisig proposal on-chain and extracts the created proposal ID from events.
 */
export async function createProposal(
  actionType: ProposalActionType,
  params: ProposalActionParams,
  options: ActionOptions
): Promise<CreateProposalResult> {
  const actionScVal = buildProposalArgs(actionType, params);

  const res = await executeMultisigWrite(
    'create_proposal',
    [
      new Address(options.signerAddress).toScVal(),
      actionScVal,
    ],
    options
  );

  const proposalId = extractProposalIdFromTxResponse(res.txResponse);

  return {
    txHash: res.txHash,
    status: 'confirmed',
    proposalId,
  };
}
