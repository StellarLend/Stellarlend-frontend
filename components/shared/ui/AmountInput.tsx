import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input, InputProps } from '@/components/shared/ui/Input';
import { cn } from '@/lib/utils/cn';

export interface AmountInputProps extends Omit<InputProps, 'value' | 'onChange'> {
  value: number;
  onChange: (value: number) => void;
  precision?: number;
  unit?: string;
  max?: number;
  onMax?: () => void;
}

export const AmountInput = React.forwardRef<HTMLInputElement, AmountInputProps>(
  (props, ref) => {
    const {
      value,
      onChange,
      precision = 2,
      unit,
      max,
      onMax,
      className,
      containerClassName,
      label,
      error,
      helperText,
      id,
      ...rest
    } = props;

    const [displayValue, setDisplayValue] = useState<string>('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync forwarded ref
    useEffect(() => {
      if (typeof ref === 'function') {
        ref(inputRef.current);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLInputElement | null>).current = inputRef.current;
      }
    }, [ref]);

    // Format number to string with commas
    const formatWithCommas = useCallback((val: number, prec: number): string => {
      if (isNaN(val)) return '';
      const parts = val.toFixed(prec).split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return parts.join('.');
    }, []);

    // Convert string with commas to number
    const parseWithCommas = (val: string): number => {
      const clean = val.replace(/,/g, '');
      return parseFloat(clean);
    };

    // Update display value when external value changes
    useEffect(() => {
      const formatted = formatWithCommas(value, precision);
      // Only update if the difference is not just a decimal point being typed
      if (formatted !== displayValue && !displayValue.endsWith('.')) {
        setDisplayValue(formatted);
      }
    }, [value, precision, formatWithCommas]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const originalCursorPosition = input.selectionStart;
      const originalValue = input.value;

      // Remove commas to get the raw numeric input
      let rawValue = originalValue.replace(/,/g, '');

      // Allow only digits and one decimal point
      const parts = rawValue.split('.');
      if (parts.length > 2) {
        rawValue = parts[0] + '.' + parts.slice(1).join('');
      }

      // Limit precision
      if (parts.length === 2 && parts[1].length > precision) {
        rawValue = parts[0] + '.' + parts[1].slice(0, precision);
      }

      // If user typed something that's not a number (e.g. just a dot or nothing)
      const numericValue = parseFloat(rawValue);
      const isInvalid = isNaN(numericValue) && rawValue !== '';

      if (!isInvalid) {
        onChange(isNaN(numericValue) ? 0 : numericValue);
      }

      // Now, how to update displayValue while keeping the cursor position?
      // We'll format the rawValue with commas.
      const formatted = formatWithCommas(isNaN(numericValue) ? 0 : numericValue, parts.length > 1 ? parts[1].length : 0);
      
      // If user just typed a dot, we need to make sure it's preserved
      const finalDisplayValue = rawValue.endsWith('.') ? formatWithCommas(isNaN(numericValue) ? 0 : numericValue, 0) + '.' : formatted;

      setDisplayValue(finalDisplayValue);

      // Restore cursor position
      // This is still a bit tricky. We need to find the position in the formatted string.
      // A simple way: the number of characters before the cursor in the raw value.
      // We find the same number of non-comma characters in the new display value.
      setTimeout(() => {
        if (inputRef.current) {
          let count = 0;
          let newPos = 0;
          // We want to find the position in finalDisplayValue that corresponds to originalCursorPosition in rawValue
          // originalCursorPosition is the position in originalValue (which has commas)
          // Wait, the user's cursor position is relative to the input they are seeing.
          
          // Let's try a simpler approach for the cursor:
          // Calculate how many non-comma characters were before the cursor.
          let nonCommaCount = 0;
          for (let i = 0; i < originalCursorPosition; i++) {
            if (originalValue[i] !== ',') {
              nonCommaCount++;
            }
          }

          // Find the position in finalDisplayValue that has nonCommaCount non-comma characters.
          let currentNonCommaCount = 0;
          for (let i = 0; i < finalDisplayValue.length; i++) {
            if (finalDisplayValue[i] !== ',') {
              if (currentNonCommaCount === nonCommaCount) {
                newPos = i;
                break;
              }
              currentNonCommaCount++;
            }
          }
          if (newPos === 0 && nonCommaCount > 0) {
             // if it's the first non-comma char
             // handled by the loop
          }

          inputRef.current.setSelectionRange(newPos, newPos);
        }
      }, 0);
    };

    return (
      <div className={cn('relative w-full', containerClassName)}>
        <Input
          {...rest}
          id={id}
          ref={inputRef}
          label={label}
          error={error}
          helperText={helperText}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          className={cn(
            className,
            unit && 'pr-16',
            onMax && 'pr-14'
          )}
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500 pointer-events-none">
            {unit}
          </span>
        )}
        {onMax && (
          <button
            type="button"
            onClick={onMax}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-green-600 hover:text-green-700 bg-green-50 px-2 py-1 rounded transition-colors"
          >
            MAX
          </button>
        )}
      </div>
    );
  }
);

AmountInput.displayName = 'AmountInput';
