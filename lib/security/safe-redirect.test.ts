import { describe, it, expect } from 'vitest';
import { safeRedirectPath } from './safe-redirect';

describe('safeRedirectPath', () => {
  describe('null / undefined / empty', () => {
    it('returns "/" for null', () => {
      expect(safeRedirectPath(null)).toBe('/');
    });

    it('returns "/" for undefined', () => {
      expect(safeRedirectPath(undefined)).toBe('/');
    });

    it('returns "/" for empty string', () => {
      expect(safeRedirectPath('')).toBe('/');
    });

    it('returns "/" for whitespace-only string', () => {
      expect(safeRedirectPath('   ')).toBe('/');
    });
  });

  describe('root path', () => {
    it('returns "/" unchanged', () => {
      expect(safeRedirectPath('/')).toBe('/');
    });
  });

  describe('allowed internal paths', () => {
    it('passes /dashboard', () => {
      expect(safeRedirectPath('/dashboard')).toBe('/dashboard');
    });

    it('passes /dashboard with trailing path', () => {
      expect(safeRedirectPath('/dashboard/analytics')).toBe('/dashboard/analytics');
    });

    it('passes /dashboard with query string', () => {
      expect(safeRedirectPath('/dashboard?tab=borrow')).toBe('/dashboard?tab=borrow');
    });

    it('passes /lending', () => {
      expect(safeRedirectPath('/lending')).toBe('/lending');
    });

    it('passes /lending with trailing path', () => {
      expect(safeRedirectPath('/lending/market/usdc')).toBe('/lending/market/usdc');
    });

    it('passes /account', () => {
      expect(safeRedirectPath('/account')).toBe('/account');
    });

    it('passes /account/profile', () => {
      expect(safeRedirectPath('/account/profile')).toBe('/account/profile');
    });

    it('passes /account/notifications', () => {
      expect(safeRedirectPath('/account/notifications')).toBe('/account/notifications');
    });
  });

  describe('absolute URLs', () => {
    it('rejects https://evil.com', () => {
      expect(safeRedirectPath('https://evil.com')).toBe('/');
    });

    it('rejects http://evil.com', () => {
      expect(safeRedirectPath('http://evil.com')).toBe('/');
    });

    it('rejects https://evil.com/dashboard (path mimicry)', () => {
      expect(safeRedirectPath('https://evil.com/dashboard')).toBe('/');
    });

    it('rejects ftp://evil.com', () => {
      expect(safeRedirectPath('ftp://evil.com')).toBe('/');
    });
  });

  describe('protocol-relative URLs', () => {
    it('rejects //evil.com', () => {
      expect(safeRedirectPath('//evil.com')).toBe('/');
    });

    it('rejects //evil.com/dashboard', () => {
      expect(safeRedirectPath('//evil.com/dashboard')).toBe('/');
    });
  });

  describe('dangerous protocol schemes', () => {
    it('rejects javascript:alert(1)', () => {
      expect(safeRedirectPath('javascript:alert(1)')).toBe('/');
    });

    it('rejects JavaScript: (mixed case)', () => {
      expect(safeRedirectPath('JavaScript:alert(1)')).toBe('/');
    });

    it('rejects whitespace-padded javascript:', () => {
      expect(safeRedirectPath(' javascript:alert(1)')).toBe('/');
    });

    it('rejects data:text/html,<script>alert(1)</script>', () => {
      expect(safeRedirectPath('data:text/html,<script>alert(1)</script>')).toBe('/');
    });

    it('rejects vbscript:msgbox(1)', () => {
      expect(safeRedirectPath('vbscript:msgbox(1)')).toBe('/');
    });
  });

  describe('encoded payloads', () => {
    it('rejects URL-encoded https://evil.com', () => {
      expect(safeRedirectPath('https%3A%2F%2Fevil.com')).toBe('/');
    });

    it('rejects double-encoded payload', () => {
      expect(safeRedirectPath('%68%74%74%70%73%3A%2F%2Fevil.com')).toBe('/');
    });

    it('rejects encoded //evil.com', () => {
      expect(safeRedirectPath('%2F%2Fevil.com')).toBe('/');
    });

    it('rejects encoded javascript: scheme', () => {
      expect(safeRedirectPath('javascript%3Aalert(1)')).toBe('/');
    });

    it('correctly decodes and passes a valid encoded internal path', () => {
      expect(safeRedirectPath('%2Fdashboard')).toBe('/dashboard');
    });
  });

  describe('non-internal paths', () => {
    it('defaults unknown path to "/"', () => {
      expect(safeRedirectPath('/unknown')).toBe('/');
    });

    it('defaults /admin to "/" (not in allowlist)', () => {
      expect(safeRedirectPath('/admin')).toBe('/');
    });

    it('defaults path without leading slash to "/"', () => {
      expect(safeRedirectPath('dashboard')).toBe('/');
    });
  });

  describe('path-only query/hash strings', () => {
    it('rejects query-only string and defaults to "/"', () => {
      expect(safeRedirectPath('?foo=bar')).toBe('/');
    });

    it('rejects hash-only string and defaults to "/"', () => {
      expect(safeRedirectPath('#section')).toBe('/');
    });
  });

  describe('hash fragment on valid path', () => {
    it('passes /dashboard with hash', () => {
      expect(safeRedirectPath('/dashboard#section')).toBe('/dashboard#section');
    });

    it('passes /lending with hash', () => {
      expect(safeRedirectPath('/lending#market')).toBe('/lending#market');
    });
  });
});
