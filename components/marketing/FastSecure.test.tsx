import React from 'react';
import { render, screen } from '@testing-library/react';
import FastSecure from './FastSecure';

beforeAll(() => {
  // framer-motion uses IntersectionObserver; mock it for jsdom tests
  class MockIntersectionObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // @ts-ignore - test env global
  global.IntersectionObserver = MockIntersectionObserver as any;
});

describe('FastSecure', () => {
  it("'Learn About Security' CTA links to the /security route", () => {
    render(<FastSecure />);

    const securityLink = screen.getByRole('link', { name: /learn about security/i });
    expect(securityLink).toHaveAttribute('href', '/security');
  });
});
