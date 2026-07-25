import React from 'react';
import { render, screen, act } from '@testing-library/react';
import TestimonialsSection from './testimonial';

describe('TestimonialsSection', () => {
  beforeEach(() => {
    // Mock innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1200, // Starts at desktop width
    });
  });

  it('resizes mid-carousel and asserts cards are always visible', () => {
    jest.useFakeTimers();
    render(<TestimonialsSection />);

    // Initially at desktop width (cardsPerView = 3)
    // There are 6 testimonials total. Max slides = 2.
    // Let's trigger next slide to go to slide index 1 (the last slide for desktop)
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    // Now currentSlide is 1.

    // Resize window to mobile width (cardsPerView = 1)
    // For cardsPerView = 1, maxSlides = 6. currentSlide 1 is valid (1 < 6).
    // The resize handler should just update cardsPerView, and clamp (Math.min(1, 5) -> 1).
    // Then let's move to slide 5 (the last slide for mobile).
    act(() => {
      window.innerWidth = 400;
      window.dispatchEvent(new Event('resize'));
    });

    act(() => {
      // Advance to slide 5
      jest.advanceTimersByTime(5000); // 2
      jest.advanceTimersByTime(5000); // 3
      jest.advanceTimersByTime(5000); // 4
      jest.advanceTimersByTime(5000); // 5
    });

    // Now currentSlide is 5.
    
    // Resize back to desktop (cardsPerView = 3)
    // maxSlides becomes 2. currentSlide 5 is clamped to Math.min(5, 1) -> 1.
    act(() => {
      window.innerWidth = 1200;
      window.dispatchEvent(new Event('resize'));
    });

    // We should not render an empty carousel.
    // Slide index 1 with 3 cards per view shows testimonials 3, 4, 5.
    // Let's check if cards are visible.
    // Testimonial 3 has text "The non-custodial nature"
    expect(screen.getByText(/The non-custodial nature/i)).toBeInTheDocument();
    
    jest.useRealTimers();
  });
});
