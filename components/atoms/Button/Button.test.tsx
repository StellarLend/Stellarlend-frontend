import { render, screen } from '@testing-library/react'
import "@testing-library/jest-dom";
import Button from './Button';
// 


test('renders button with text', () => {
  render(<Button>Test</Button>)
  expect(screen.getByText('Test')).toBeInTheDocument()
})