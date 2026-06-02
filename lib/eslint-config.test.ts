import { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const eslintConfig = require('../.eslintrc.js');

function verify(code: string) {
  const linter = new Linter();

  return linter.verify(code, {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: eslintConfig.rules,
  });
}

describe('eslint RPC env guard', () => {
  it('rejects direct NEXT_PUBLIC RPC env access', () => {
    const messages = verify("const rpcUrl = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL;");

    expect(messages).toHaveLength(1);
    expect(messages[0].message).toContain('Do not expose RPC endpoints');
  });

  it('rejects computed NEXT_PUBLIC RPC env access', () => {
    const messages = verify("const rpcUrl = process.env['NEXT_PUBLIC_CUSTOM_RPC_URL'];");

    expect(messages).toHaveLength(1);
    expect(messages[0].message).toContain('Do not expose RPC endpoints');
  });

  it('allows non-RPC public env access', () => {
    const messages = verify("const horizonUrl = process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL;");

    expect(messages).toHaveLength(0);
  });
});
