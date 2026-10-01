import { ESLint } from 'eslint';
import { describe, it, expect } from 'vitest';
import path from 'path';

describe('.eslintrc.js', () => {
  it('should load the config without errors', async () => {
    const eslint = new ESLint({
      useEslintrc: false,
      overrideConfigFile: path.resolve(__dirname, '../.eslintrc.js'),
    });
    expect(eslint).toBeDefined();
  });

  describe('no-restricted-syntax: RPC env vars protection', () => {
    const eslint = new ESLint({
      useEslintrc: false,
      overrideConfigFile: path.resolve(__dirname, '../.eslintrc.js'),
    });

    it('success scenario: should allow valid NEXT_PUBLIC_ env vars', async () => {
      const results = await eslint.lintText(`
        const a = process.env.NEXT_PUBLIC_API_URL;
        const b = process.env['NEXT_PUBLIC_OTHER_VAR'];
        const { NEXT_PUBLIC_SOME_KEY } = process.env;
        const { NEXT_PUBLIC_NORMAL_KEY: myKey } = process.env;
      `);
      
      const messages = results[0]?.messages.filter(m => m.ruleId === 'no-restricted-syntax') || [];
      expect(messages.length).toBe(0);
    });

    it('rejection scenario: should report errors for restricted NEXT_PUBLIC_.*RPC.* env vars', async () => {
      const results = await eslint.lintText(`
        // MemberExpression with dot notation
        const w = process.env.NEXT_PUBLIC_MAINNET_RPC_URL;
        
        // MemberExpression with bracket notation
        const x = process.env['NEXT_PUBLIC_TESTNET_RPC'];
        
        // VariableDeclarator with ObjectPattern
        const { NEXT_PUBLIC_RPC_ENDPOINT } = process.env;
        
        // VariableDeclarator with ObjectPattern and aliasing
        const { NEXT_PUBLIC_MAINNET_RPC_URL: rpc } = process.env;
      `);
      
      const messages = results[0]?.messages.filter(m => m.ruleId === 'no-restricted-syntax') || [];
      expect(messages.length).toBe(4);
      
      messages.forEach(msg => {
        expect(msg.message).toContain('Do not expose RPC endpoints via NEXT_PUBLIC_* env vars');
      });
    });

    it('boundary scenario: should catch exact matches and different structures', async () => {
      const results = await eslint.lintText(`
        // Exact match
        const a = process.env.NEXT_PUBLIC_RPC;
        
        // Duplicates and multiple usages
        const b = process.env.NEXT_PUBLIC_RPC;
        
        // Bracket with string literal exact match
        const c = process.env['NEXT_PUBLIC_RPC'];
      `);
      
      const messages = results[0]?.messages.filter(m => m.ruleId === 'no-restricted-syntax') || [];
      expect(messages.length).toBe(3);
    });

    it('regression scenario: should not block non-NEXT_PUBLIC RPC vars', async () => {
      const results = await eslint.lintText(`
        const x = process.env.PRIVATE_RPC_URL;
        const y = process.env['INTERNAL_RPC'];
        const { SERVER_RPC_ENDPOINT } = process.env;
      `);
      
      const messages = results[0]?.messages.filter(m => m.ruleId === 'no-restricted-syntax') || [];
      expect(messages.length).toBe(0);
    });
  });
});
