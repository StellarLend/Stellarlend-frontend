/// <reference types="node" />

declare module 'node:path' {
  export * from 'path';
}

declare module 'node:url' {
  export * from 'url';
}

declare module 'vitest/config' {
  export * from 'vitest';
}

declare module 'vitest/globals' {
  export const describe: typeof import('vitest').describe;
  export const it: typeof import('vitest').it;
  export const expect: typeof import('vitest').expect;
  export const beforeEach: typeof import('vitest').beforeEach;
  export const afterEach: typeof import('vitest').afterEach;
  export const vi: typeof import('vitest').vi;
}
