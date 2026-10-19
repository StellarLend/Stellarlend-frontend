import { Address, xdr, scValToNative } from '@stellar/stellar-sdk';
import crypto from 'crypto';

export const APPROVAL_DOMAIN_SEPARATOR = Buffer.from('STELLARLEND_MULTISIG_APPROVAL_V1', 'utf8');

/**
 * Builds the canonical byte preimage for a domain-bound proposal approval:
 * APPROVAL_DOMAIN_SEPARATOR || contract_id_xdr || proposal_id (8-byte BE) || signer_set_hash (32 bytes) || approver_xdr
 */
export function buildApprovalBindingPreimage(
  contractId: string,
  proposalId: number | bigint,
  approverAddress: string,
  signerSetHash: string | Uint8Array | Buffer
): Buffer {
  const contractAddressXdr = new Address(contractId).toScAddress().toXDR();
  
  const proposalIdBe = Buffer.alloc(8);
  proposalIdBe.writeBigUInt64BE(BigInt(proposalId), 0);

  const signerSetHashBytes =
    typeof signerSetHash === 'string'
      ? Buffer.from(signerSetHash.replace(/^0x/, ''), 'hex')
      : Buffer.from(signerSetHash);

  if (signerSetHashBytes.length !== 32) {
    throw new Error(`signer_set_hash must be exactly 32 bytes, received ${signerSetHashBytes.length}`);
  }

  const approverXdr = new Address(approverAddress).toScAddress().toXDR();

  return Buffer.concat([
    APPROVAL_DOMAIN_SEPARATOR,
    contractAddressXdr,
    proposalIdBe,
    signerSetHashBytes,
    approverXdr,
  ]);
}

/**
 * Computes the SHA-256 hash of the canonical approval binding preimage.
 */
export function computeApprovalBindingHash(
  contractId: string,
  proposalId: number | bigint,
  approverAddress: string,
  signerSetHash: string | Uint8Array | Buffer
): Buffer {
  const preimage = buildApprovalBindingPreimage(
    contractId,
    proposalId,
    approverAddress,
    signerSetHash
  );
  return crypto.createHash('sha256').update(preimage).digest();
}

function extractArgsFromInvocation(invocation: any): any[] {
  const argsList: any[] = [];
  if (!invocation) return argsList;

  try {
    if (typeof invocation.function === 'function') {
      const fn = invocation.function();
      if (fn && typeof fn.contractFn === 'function') {
        const contractFn = fn.contractFn();
        if (contractFn && typeof contractFn.args === 'function') {
          argsList.push(...contractFn.args());
        }
      }
    } else if (invocation.function?.contractFn?.args) {
      argsList.push(...invocation.function.contractFn.args);
    }
  } catch {}

  try {
    if (Array.isArray(invocation.args)) {
      argsList.push(...invocation.args);
    }
  } catch {}

  try {
    const subs = typeof invocation.subInvocations === 'function'
      ? invocation.subInvocations()
      : invocation.subInvocations || [];
    for (const sub of subs) {
      argsList.push(...extractArgsFromInvocation(sub));
    }
  } catch {}

  return argsList;
}

/**
 * Verifies that the simulated Soroban authorization entry carries the exact expected domain binding hash.
 */
export function verifyAuthEntryBinding(
  entry: any,
  expectedBindingHash: Buffer | string
): boolean {
  try {
    const expectedBuf =
      typeof expectedBindingHash === 'string'
        ? Buffer.from(expectedBindingHash.replace(/^0x/, ''), 'hex')
        : expectedBindingHash;

    if (!entry) return false;

    // Check if entry itself is raw or wrapped
    let invocations: any[] = [];
    if (typeof entry.rootInvocation === 'function') {
      invocations.push(entry.rootInvocation());
    } else if (entry.rootInvocation) {
      invocations.push(entry.rootInvocation);
    } else {
      invocations.push(entry);
    }

    const allArgs: any[] = [];
    for (const inv of invocations) {
      allArgs.push(...extractArgsFromInvocation(inv));
    }

    // Direct check if entry has top-level args
    if (Array.isArray(entry.args)) {
      allArgs.push(...entry.args);
    }

    for (const arg of allArgs) {
      try {
        let nativeVal: any;
        if (typeof arg === 'object' && typeof (arg as any).toXDR === 'function') {
          nativeVal = scValToNative(arg);
        } else if (Buffer.isBuffer(arg) || arg instanceof Uint8Array) {
          nativeVal = Buffer.from(arg);
        } else {
          nativeVal = arg;
        }

        if (Buffer.isBuffer(nativeVal) || nativeVal instanceof Uint8Array) {
          const buf = Buffer.from(nativeVal);
          if (buf.length === 32 && crypto.timingSafeEqual(buf, expectedBuf)) {
            return true;
          }
        } else if (typeof nativeVal === 'string') {
          const clean = nativeVal.replace(/^0x/, '');
          if (clean.length === 64 && clean.toLowerCase() === expectedBuf.toString('hex').toLowerCase()) {
            return true;
          }
        }
      } catch {
        continue;
      }
    }

    return false;
  } catch {
    return false;
  }
}
