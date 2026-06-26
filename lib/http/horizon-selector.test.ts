import { describe, it, expect } from 'vitest';
import { HorizonSelector } from './horizon-selector';

describe('HorizonSelector', () => {
  it('rotates between healthy endpoints', () => {
    const selector = new HorizonSelector(['https://primary.example.com', 'https://secondary.example.com']);

    const first = selector.selectEndpoint().url;
    const second = selector.selectEndpoint().url;
    const third = selector.selectEndpoint().url;
    const fourth = selector.selectEndpoint().url;

    expect(new Set([first, second, third, fourth])).toEqual(
      new Set(['https://primary.example.com', 'https://secondary.example.com']),
    );
  });

  it('penalizes endpoints with recent failures', () => {
    const selector = new HorizonSelector(['https://primary.example.com', 'https://secondary.example.com']);

    selector.recordFailure('https://primary.example.com');

    const picks = Array.from({ length: 4 }, () => selector.selectEndpoint().url);
    const secondaryCount = picks.filter((url) => url === 'https://secondary.example.com').length;

    expect(secondaryCount).toBeGreaterThan(1);
  });

  it('normalizes duplicate endpoint URLs', () => {
    const selector = new HorizonSelector(['https://primary.example.com/', 'https://primary.example.com']);
    expect(selector.getUrls()).toEqual(['https://primary.example.com']);
  });
});
