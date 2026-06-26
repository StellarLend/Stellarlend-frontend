import { describe, it, expect, beforeEach } from 'vitest';
import { POST, resetThrottleRegistry } from '../app/api/account/export/route';

describe('GDPR DSAR Account Export API Route Flow', () => {
  beforeEach(() => {
    resetThrottleRegistry();
  });

  it('should accept a valid request and return a 202 status containing the secure signed download url', async () => {
    const mockReq = new Request('https://localhost/api/account/export', { method: 'POST' });
    const response = await POST(mockReq);
    
    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.downloadUrl).toContain('https://storage.stellarlend.com/exports/');
    expect(body.expiresInSeconds).toBe(900);
  });

  it('should explicitly trigger a 429 status code when secondary requests occur inside the 24 hour limit window', async () => {
    const mockReq1 = new Request('https://localhost/api/account/export', { method: 'POST' });
    const firstResponse = await POST(mockReq1);
    expect(firstResponse.status).toBe(202);

    // Immediate second attempt within identical throttle lock lifecycle
    const mockReq2 = new Request('https://localhost/api/account/export', { method: 'POST' });
    const secondResponse = await POST(mockReq2);
    
    expect(secondResponse.status).toBe(429);
    const body = await secondResponse.json();
    expect(body.error).toContain('DSAR export rate limit exceeded');
  });
});
