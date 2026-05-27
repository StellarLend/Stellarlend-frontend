// jest.setup.ts
import '@testing-library/jest-dom';

// Mock environment variables for tests
process.env.JWT_SECRET = 'test-secret-key';
process.env.NEXT_PUBLIC_SESSION_COOKIE = 'session';
process.env.AUTH_SECRET = 'test-auth-secret';