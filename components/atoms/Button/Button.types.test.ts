import { validateButtonProps, ButtonProps } from './Button.types';

describe('validateButtonProps', () => {
  const validProps: Partial<ButtonProps> = {
    variant: 'primary',
    size: 'md',
    className: 'custom-class',
    onClick: () => {},
    isLoading: false,
    children: 'Click me',
  };

  test('passes with valid props', () => {
    expect(() => validateButtonProps(validProps)).not.toThrow();
  });

  test('throws on invalid variant', () => {
    const props = { ...validProps, variant: 'invalid' as any };
    expect(() => validateButtonProps(props)).toThrow(/invalid variant/i);
  });

  test('throws on invalid size', () => {
    const props = { ...validProps, size: 'huge' as any };
    expect(() => validateButtonProps(props)).toThrow(/invalid size/i);
  });

  test('throws on empty className', () => {
    const props = { ...validProps, className: '' };
    expect(() => validateButtonProps(props)).toThrow(/className cannot be an empty string/i);
  });

  test('throws on non‑string className', () => {
    const props = { ...validProps, className: (['a', 'b'] as unknown) as any };
    expect(() => validateButtonProps(props)).toThrow(/className must be a string/i);
  });

  test('throws when children is missing', () => {
    const { children, ...rest } = validProps;
    expect(() => validateButtonProps(rest as Partial<ButtonProps>)).toThrow(/children must be provided/i);
  });
});
