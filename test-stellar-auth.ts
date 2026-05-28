import { Keypair, Networks, TransactionBuilder, Utils } from '@stellar/stellar-sdk';
import * as jose from 'jose';

async function test() {
  console.log('Testing Stellar SDK and Jose');
  
  const serverKeypair = Keypair.random();
  const clientKeypair = Keypair.random();
  
  console.log('Server Public Key:', serverKeypair.publicKey());
  console.log('Client Public Key:', clientKeypair.publicKey());
  
  try {
    const challengeTx = Utils.buildChallengeTx(
      serverKeypair,
      clientKeypair.publicKey(),
      'testnet',
      300,
      'Stellarlend'
    );
    
    console.log('Challenge TX built');
    
    // Sign with client
    const tx = Utils.readChallengeTx(
      challengeTx,
      serverKeypair.publicKey(),
      'testnet',
      'Stellarlend'
    );
    tx.sign(clientKeypair);
    
    console.log('Challenge TX signed');
    
    const valid = Utils.verifyChallengeTxThreshold(
      tx.toXDR(),
      serverKeypair.publicKey(),
      'testnet',
      'Stellarlend',
      serverKeypair.publicKey()
    );
    console.log('Verify Result:', valid);
    
    const secret = new TextEncoder().encode('my-secret');
    const jwt = await new jose.SignJWT({ 'urn:example:claim': true })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer('urn:example:issuer')
      .setAudience('urn:example:audience')
      .setExpirationTime('2h')
      .sign(secret);
      
    console.log('JWT:', jwt);
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
