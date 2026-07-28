// lib/auth/wallet.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Keypair, Networks, WebAuth } from '@stellar/stellar-sdk';

// ---------------------------------------------------------------------------
// Mock lib/config so the module doesn't attempt to validate env variables
// that aren't relevant to these unit tests.
// ---------------------------------------------------------------------------
vi.mock('@/lib/config', () => ({
  default: {
    stellar: { network: 'testnet' },
  },
}));

// ---------------------------------------------------------------------------
// Capture the server keypair injected via env so tests are deterministic.
// We generate a fresh keypair per describe-block via beforeEach.
// ---------------------------------------------------------------------------
let serverKeypair: Keypair;
let clientKeypair: Keypair;

describe('lib/auth/wallet – generateWalletChallenge', () => {
  beforeEach(async () => {
    // Reset the module so the cached serverKeypair is cleared between tests
    vi.resetModules();

    serverKeypair = Keypair.random();
    clientKeypair = Keypair.random();

    // Inject a known signing secret so wallet.ts uses our keypair
    vi.stubEnv('STELLAR_SIGNING_SECRET', serverKeypair.secret());
    vi.stubEnv('NEXT_PUBLIC_APP_DOMAIN', 'localhost:3000');
  });

  it('returns a non-empty XDR string for a valid public key', async () => {
    const { generateWalletChallenge } = await import('./wallet');
    const xdr = await generateWalletChallenge(clientKeypair.publicKey());
    expect(typeof xdr).toBe('string');
    expect(xdr.length).toBeGreaterThan(0);
  });

  it('throws for an invalid public key', async () => {
    const { generateWalletChallenge } = await import('./wallet');
    await expect(generateWalletChallenge('not-a-valid-key')).rejects.toThrow(
      'Invalid Stellar public key',
    );
  });

  it('produces a transaction that can be read back by the SDK', async () => {
    const { generateWalletChallenge } = await import('./wallet');
    const xdr = await generateWalletChallenge(clientKeypair.publicKey());

    // readChallengeTx will throw if the XDR is malformed or signed by the
    // wrong keypair, so a successful call proves the challenge is well-formed.
    const { clientAccountID } = WebAuth.readChallengeTx(
      xdr,
      serverKeypair.publicKey(),
      Networks.TESTNET,
      'localhost:3000',
      'localhost:3000',
    );

    expect(clientAccountID).toBe(clientKeypair.publicKey());
  });
});

describe('lib/auth/wallet – verifyWalletSignature', () => {
  beforeEach(async () => {
    vi.resetModules();

    serverKeypair = Keypair.random();
    clientKeypair = Keypair.random();

    vi.stubEnv('STELLAR_SIGNING_SECRET', serverKeypair.secret());
    vi.stubEnv('NEXT_PUBLIC_APP_DOMAIN', 'localhost:3000');
  });

  it('returns the client public key for a correctly signed challenge', async () => {
    const { generateWalletChallenge, verifyWalletSignature } = await import('./wallet');

    // 1. Generate challenge
    const challengeXdr = await generateWalletChallenge(clientKeypair.publicKey());

    // 2. Client signs the challenge (simulates what the browser wallet does)
    const { tx } = WebAuth.readChallengeTx(
      challengeXdr,
      serverKeypair.publicKey(),
      Networks.TESTNET,
      'localhost:3000',
      'localhost:3000',
    );
    tx.sign(clientKeypair);
    const signedXdr = tx.toEnvelope().toXDR('base64');

    // 3. Verify the signed challenge
    const walletAddress = await verifyWalletSignature(signedXdr);
    expect(walletAddress).toBe(clientKeypair.publicKey());
  });

  it('rejects a challenge signed by the wrong keypair', async () => {
    const { generateWalletChallenge, verifyWalletSignature } = await import('./wallet');
    const wrongKeypair = Keypair.random();

    const challengeXdr = await generateWalletChallenge(clientKeypair.publicKey());

    const { tx } = WebAuth.readChallengeTx(
      challengeXdr,
      serverKeypair.publicKey(),
      Networks.TESTNET,
      'localhost:3000',
      'localhost:3000',
    );
    // Sign with the wrong keypair
    tx.sign(wrongKeypair);
    const signedXdr = tx.toEnvelope().toXDR('base64');

    await expect(verifyWalletSignature(signedXdr)).rejects.toThrow(
      'Signature verification failed',
    );
  });

  it('rejects an unsigned challenge', async () => {
    const { generateWalletChallenge, verifyWalletSignature } = await import('./wallet');

    const challengeXdr = await generateWalletChallenge(clientKeypair.publicKey());

    // Pass the raw (unsigned) challenge back directly
    await expect(verifyWalletSignature(challengeXdr)).rejects.toThrow(
      'Signature verification failed',
    );
  });

  it('rejects a tampered / garbage XDR string', async () => {
    const { verifyWalletSignature } = await import('./wallet');

    await expect(verifyWalletSignature('not-valid-xdr')).rejects.toThrow(
      'Signature verification failed',
    );
  });
});
