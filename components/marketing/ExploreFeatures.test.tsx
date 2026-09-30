import React from 'react';
import { render, screen } from '@testing-library/react';
import ExploreFeatures from './ExploreFeatures';

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

describe('ExploreFeatures', () => {
  it("'Borrow Now' CTA links to /lending?tab=borrow", () => {
    render(<ExploreFeatures />);

    const borrowLink = screen.getByRole('link', { name: /borrow now/i });
    expect(borrowLink).toHaveAttribute('href', '/lending?tab=borrow');
  });
});
