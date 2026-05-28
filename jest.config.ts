import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
    dir: './',
});

const config: Config = {
    coverageProvider: 'v8',
    testEnvironment: 'node',  // ← Change from 'jsdom' to 'node'

    testMatch: [
        '**/__tests__/**/*.test.ts',
        '**/__tests__/**/*.test.tsx',
        '**/*.test.ts',
        '**/*.test.tsx',
    ],

    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
    },

    collectCoverageFrom: [
        'app/**/*.ts',
        'app/**/*.tsx',
        'lib/**/*.ts',
        'components/**/*.ts',
        'components/**/*.tsx',
        '!**/*.d.ts',
        '!**/node_modules/**',
        '!**/.next/**',
    ],

    coverageThreshold: {
        global: {
            branches: 90,
            functions: 95,
            lines: 95,
            statements: 95,
        },
    },
};

export default createJestConfig(config);