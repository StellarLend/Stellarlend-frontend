import React from 'react';
import { render, fireEvent } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ScrollCues from "./ScrollCues";

describe("ScrollCues", () => {
  let ResizeObserverMock: any;
  let observeMock: any;
  let disconnectMock: any;

  beforeEach(() => {
    observeMock = vi.fn();
    disconnectMock = vi.fn();

    ResizeObserverMock = vi.fn(() => ({
      observe: observeMock,
      disconnect: disconnectMock,
    }));
    
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const setupDimensions = (el: HTMLElement, dimensions: { scrollWidth: number; clientWidth: number; scrollLeft: number }) => {
    Object.defineProperty(el, 'scrollWidth', { configurable: true, value: dimensions.scrollWidth });
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: dimensions.clientWidth });
    Object.defineProperty(el, 'scrollLeft', { configurable: true, value: dimensions.scrollLeft });
  };

  it("shows no gradients when there is no overflow", () => {
    const { container } = render(
      <ScrollCues>
        <div>Content</div>
      </ScrollCues>
    );
    const wrapper = container.firstChild as HTMLElement;
    setupDimensions(wrapper, { scrollWidth: 100, clientWidth: 100, scrollLeft: 0 });
    
    // trigger update
    fireEvent.scroll(wrapper);

    expect(wrapper.querySelectorAll('.bg-gradient-to-r').length).toBe(0);
    expect(wrapper.querySelectorAll('.bg-gradient-to-l').length).toBe(0);
  });

  it("shows right gradient when there is overflow and scrolled to start", () => {
    const { container } = render(
      <ScrollCues>
        <div>Content</div>
      </ScrollCues>
    );
    const wrapper = container.firstChild as HTMLElement;
    setupDimensions(wrapper, { scrollWidth: 200, clientWidth: 100, scrollLeft: 0 });
    
    fireEvent.scroll(wrapper);

    expect(wrapper.querySelectorAll('.bg-gradient-to-r').length).toBe(0); // left hidden
    expect(wrapper.querySelectorAll('.bg-gradient-to-l').length).toBe(1); // right shown
  });

  it("shows both gradients when scrolled in the middle", () => {
    const { container } = render(
      <ScrollCues>
        <div>Content</div>
      </ScrollCues>
    );
    const wrapper = container.firstChild as HTMLElement;
    setupDimensions(wrapper, { scrollWidth: 200, clientWidth: 100, scrollLeft: 50 });
    
    fireEvent.scroll(wrapper);

    expect(wrapper.querySelectorAll('.bg-gradient-to-r').length).toBe(1); // left shown
    expect(wrapper.querySelectorAll('.bg-gradient-to-l').length).toBe(1); // right shown
  });

  it("shows left gradient when scrolled to the end", () => {
    const { container } = render(
      <ScrollCues>
        <div>Content</div>
      </ScrollCues>
    );
    const wrapper = container.firstChild as HTMLElement;
    setupDimensions(wrapper, { scrollWidth: 200, clientWidth: 100, scrollLeft: 100 });
    
    fireEvent.scroll(wrapper);

    expect(wrapper.querySelectorAll('.bg-gradient-to-r').length).toBe(1); // left shown
    expect(wrapper.querySelectorAll('.bg-gradient-to-l').length).toBe(0); // right hidden
  });
});
