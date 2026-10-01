import React from 'react';
import { render, screen } from '@testing-library/react'
import "@testing-library/jest-dom";
import Button from './Button';
// 


test('renders button with text', () => {
  render(<Button>Test</Button>)
  expect(screen.getByText('Test')).toBeInTheDocument()
})

test('throws on invalid variant', () => {
  // @ts-ignore
  expect(() => render(<Button variant="unknown">Bad</Button>)).toThrow(/invalid variant/);
});

test('throws on invalid size', () => {
  // @ts-ignore
  expect(() => render(<Button size="huge">Bad</Button>)).toThrow(/invalid size/);
});

test('throws on empty className', () => {
  expect(() => render(<Button className="">Empty</Button>)).toThrow(/className cannot be an empty string/);
});

test('throws on overly long className', () => {
  const longClass = 'a'.repeat(257);
  // @ts-ignore
  expect(() => render(<Button className={longClass}>Long</Button>)).toThrow(/className exceeds maximum length/);
});

test('throws on non-function onClick', () => {
  // @ts-ignore
  expect(() => render(<Button onClick="not-fn">Click</Button>)).toThrow(/onClick must be a function/);
});

test('throws on non-boolean isLoading', () => {
  // @ts-ignore
  expect(() => render(<Button isLoading="yes">Load</Button>)).toThrow(/isLoading must be a boolean/);
});

test('throws when children missing', () => {
  // @ts-ignore
  expect(() => render(<Button />)).toThrow(/children must be provided/);
});