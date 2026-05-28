import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { POST as ChallengePOST } from '@/app/api/auth/challenge/route';
import { POST as VerifyPOST } from '@/app/api/auth/verify/route';
import { Keypair, Networks, TransactionBuilder, Transaction } from '@stellar/stellar-sdk';
import { NextRequest } from 'next/server';

vi.mock('next/headers', () => {
  return {
    cookies: vi.fn().mockResolvedValue({
      set: vi.fn(),
      get: vi.fn(),
    }),
  };
});

describe('Auth API Endpoints', () => {
  let clientKeypair: Keypair;
  
  beforeAll(() => {
    clientKeypair = Keypair.random();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  const createRequest = (url: string, body: any) => {
    return new NextRequest(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  };

  it('generates a challenge for a valid wallet address', async () => {
    const request = createRequest('http://localhost:3000/api/auth/challenge', {
      walletAddress: clientKeypair.publicKey()
    });
    
    const response = await ChallengePOST(request);
    expect(response.status).toBe(200);
    
    const body = await response.json();
    expect(body.transaction).toBeDefined();
    
    // We can verify it parses as a base64 string for a transaction
    expect(() => TransactionBuilder.fromXDR(body.transaction, Networks.TESTNET)).not.toThrow();
  });
  
  it('returns 400 if walletAddress is missing', async () => {
    const request = createRequest('http://localhost:3000/api/auth/challenge', {});
    const response = await ChallengePOST(request);
    expect(response.status).toBe(400);
  });
  
  it('verifies a valid signed challenge', async () => {
    // 1. Get Challenge
    const req1 = createRequest('http://localhost:3000/api/auth/challenge', {
      walletAddress: clientKeypair.publicKey()
    });
    const res1 = await ChallengePOST(req1);
    const { transaction } = await res1.json();
    
    // 2. Parse and Sign Challenge
    const tx = TransactionBuilder.fromXDR(transaction, Networks.TESTNET) as Transaction;
    tx.sign(clientKeypair);
    const signedTxXdr = tx.toXDR();
    
    // 3. Verify Challenge
    const req2 = createRequest('http://localhost:3000/api/auth/verify', {
      transaction: signedTxXdr
    });
    
    const res2 = await VerifyPOST(req2);
    expect(res2.status).toBe(200);
    
    const body2 = await res2.json();
    expect(body2.success).toBe(true);
    expect(body2.walletAddress).toBe(clientKeypair.publicKey());
  });

  it('rejects an invalid signature', async () => {
    // 1. Get Challenge
    const req1 = createRequest('http://localhost:3000/api/auth/challenge', {
      walletAddress: clientKeypair.publicKey()
    });
    const res1 = await ChallengePOST(req1);
    const { transaction } = await res1.json();
    
    // 2. Sign Challenge with WRONG keypair
    const wrongKeypair = Keypair.random();
    const tx = TransactionBuilder.fromXDR(transaction, Networks.TESTNET) as Transaction;
    tx.sign(wrongKeypair); // Sign with different key
    const signedTxXdr = tx.toXDR();
    
    // 3. Verify Challenge
    const req2 = createRequest('http://localhost:3000/api/auth/verify', {
      transaction: signedTxXdr
    });
    
    const res2 = await VerifyPOST(req2);
    expect(res2.status).toBe(401);
  });
  
  it('returns 400 if transaction is missing during verify', async () => {
    const req = createRequest('http://localhost:3000/api/auth/verify', {});
    const res = await VerifyPOST(req);
    expect(res.status).toBe(400);
  });
});
