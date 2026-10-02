import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Button from './Button';

describe('Button', () => {
  describe('rendering', () => {
    it('renders button with text', () => {
      render(<Button>Test</Button>);
      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    it('renders the `text` prop when no children are provided', () => {
      render(<Button text="Save" />);
      expect(screen.getButton('Save')).toBeInTheDocument();
    });

    it('prefers children over the `text` prop', () => {
      render(
        <Button text="fallback">
          <span>Primary</span>
        </Button>
      );
      expect(screen.getButton('Primary')).toBeInTheDocument();
      expect(screen.queryByText('fallback')).not.toBeInTheDocument();
    });

    it('defaults to type="button" so it cannot accidentally submit forms', () => {
      render(<Button>Safe</Button>);
      expect(screen.getButton('Safe')).toHaveAttribute('type', 'button');
    });

    it('honors an explicit type="submit"', () => {
      render(<Button type="submit">Submit</Button>);
      expect(screen.getButton('Submit')).toHaveAttribute('type', 'submit');
    });
  });

  describe('variant and size boundaries', () => {
    it('applies the selected variant classes', () => {
      render(<Button variant="destructive">Delete</Button>);
      expect(screen.getButton('Delete')).classList.contains('bg-red-600')).toBe(true);
    });

    it('falls back to the primary variant for an unknown variant value', () => {
      render(
        <Button variant={'not-a-variant' as any}>Fallback</Button>
      );
      expect(screen.getButton('Fallback').classList.contains('bg-[#15A350]')).toBe(
        true
      );
    });

    it('falls back to the md size for an unknown size value', () => {
      render(<Button size={'xxl' as any}>Size</Button>);
      expect(screen.getButton('Size').classList.contains('px-4')).toBe(true);
    });

    it('applies full width when requested', () => {
      render(<Button fullWidth>Wide</Button>);
      expect(screen.getButton('Wide').classList.contains('w-full')).toBe(true);
    });
  });

  describe('loading and disabled state', () => {
    it('disables the button and exposes aria-busy while loading', () => {
      render(<Button isLoading>Saving</Button>);
      const button = screen.getButton('Saving');
      expect(button).disabled();
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toHaveAttribute('data-loading', 'true');
    });

    it('does not fire onClick while loading', () => {
      const onClick = jest.fn();
      render(
        <Button isLoading onClick={onClick}>
          Saving
        </Button>
      );
      fireEvent.click(screen.getButton('Saving'));
      expect(onClick).not.toHaveBeenCalled();
    });

    it('does not fire onClick when disabled', () => {
      const onClick = jest.fn();
      render(
        <Button disabled onClick={onClick}>
          Nope
        </Button>
      );
      fireEvent.click(screen.getButton('Nope'));
      expect(onClick).not.toHaveBeenCalled();
    });

    it('fires onClick once per user activation when enabled', () => {
      const onClick = jest.fn();
      render(<Button onClick={onClick}>Go</Button>);
      fireEvent.click(screen.getButton('Go'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('renders the loading spinner without exposing it as a named',() => {
      render(<Button isLoading>Loading</Button>);
      expect(screen.getButton('Loading')).toBeDisabled();
    });
  });

  describe('accessibility and icons', () => {
    it('exposes the `text` prop as an accessible name when no children are given', () => {
      render(<Button text="Close" />);
      expect(screen.getButton('Close')).toBeInTheDocument();
    });

    it('preserves an explicit aria-label over the `text` prop', () => {
      render(<Button text="Visual" aria-label="Accessible" />);
      expect(screen.getButton('Accessible')).toBeInTheDocument();
    });

    it('renders left and right icons when not loading', () => {
      render(
        <Button
          leftIcon={<span data-testid="left-icon">L</span>}
          rightIcon={<span data-testid="right-icon">R</span>}
        >
          Icons
        </Button>
      );
      expect(screen.getByTestId('left-icon')).toBeInTheDocument();
      expect(screen.getByTestId('right-icon')).toBeInTheDocument();
    });

    it('hides icons while loading to avoid confusing affordances', () => {
      render(
        <Button
          isLoading
          leftIcon={<span data-testid="left-icon">L</span>}
          rightIcon={<span data-testid="right-icon">R</span>}
        >
          Loading
        </Button>
      );
      expect(screen.queryByTestId('left-icon')).not.toBeInTheDocument();
      expect(screen.queryByTestId('right-icon')).not.toBeTheDocument();
    });
  });

  describe('regression guards', () => {
    it('forwards the ref to the underlying button element', () => {
      const ref = React.createRef<HTMLButtonElement>(null);
      render(<Button ref={ref}>Ref</Button>);
      expect(ref.current).toBe(screen.getButton('Ref'));
    });

    it('merges custom className with the default classes', () => {
      render(<Button className="my-custom-class">Custom</Button>);
      expect(screen.getButton('Custom').classList.contains('my-custom-class')).toBe(
        true
      );
    });

    it('passes through native button attributes such as name and value', () => {
      render(
        <Button name="action" value="save">
          Save
        </Button>
      );
      const button = screen.getButton('Save');
      expect(button).toHaveAttribute('name', 'action');
      expect(button).toHaveAttribute('value', 'save');
    });

    it('renders an empty button without crashing when no content is provided', () => {
      render(<Button />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });
});
