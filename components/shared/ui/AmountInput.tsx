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
  onQuickFill?: (percentage: number, value: number) => void;
}

/**
 * AmountInput component handles formatting and validation for monetary inputs.
 * 
 * Behaviours handled:
 * - Thousands grouping (e.g. 1,000) on input and display.
 * - Maximum decimal clamping based on `precision` prop.
 * - Paste of formatted text (stripping commas, sanitising values).
 * - Leading-zero normalisation (e.g. '00012.34' becomes '12.34').
 * - Rejection of non-numeric characters (letters/symbols).
 * - Empty value handling (emits 0 and clears the field).
 * - Maximum value clamping if `max` prop is provided.
 */
export const AmountInput = React.forwardRef<HTMLInputElement, AmountInputProps>(
  (props, ref) => {
    const {
      value,
      onChange,
      precision = 2,
      unit,
      max,
      onMax,
      onQuickFill,
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
    const formatWithCommas = useCallback((val: number, decimalPlaces?: number) => {
      const parts = val.toString().split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      if (decimalPlaces !== undefined) {
        return decimalPlaces === 0 ? parts[0] : `${parts[0]}.${parts[1] || ''.padEnd(decimalPlaces, '0')}`;
      }
      return parts.join('.');
    }, []);

    // Update display value when external value changes
    useEffect(() => {
      setDisplayValue(value === 0 ? '' : formatWithCommas(value));
    }, [value, formatWithCommas]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const originalCursorPosition = input.selectionStart;
      const originalValue = input.value;

      if (originalValue === '') {
        onChange(0);
        setDisplayValue('');
        return;
      }

      // Remove commas to get the raw numeric input
      let rawValue = originalValue.replace(/[^0-9.]/g, '');

      // Remove leading zeros
      if (rawValue.length > 1 && rawValue.startsWith('0') && rawValue[1] !== '.') {
        rawValue = rawValue.replace(/^0+/, '');
      }

      // Allow only digits and one decimal point
      const parts = rawValue.split('.');
      if (parts.length > 2) {
        rawValue = parts[0] + '.' + parts.slice(1).join('');
      }

      // Limit precision
      if (parts.length === 2 && parts[1].length > precision) {
        rawValue = parts[0] + '.' + parts[1].slice(0, precision);
      }

      let numericValue = parseFloat(rawValue);

      // Clamp to max
      if (max !== undefined && numericValue > max) {
        numericValue = max;
        rawValue = max.toString();
      }

      const isInvalid = isNaN(numericValue);

      if (!isInvalid) {
        onChange(numericValue);
      }

      // Now, how to update displayValue while keeping the cursor position?
      // We'll format the rawValue with commas.
      const formatted = formatWithCommas(isNaN(numericValue) ? 0 : numericValue, parts.length > 1 ? parts[1].length : 0);
      
      // If user just typed a dot, we need to make sure it's preserved
      const finalDisplayValue = rawValue.endsWith('.') ? formatWithCommas(isNaN(numericValue) ? 0 : numericValue, 0) + '.' : formatted;

      setDisplayValue(finalDisplayValue);

      // Restore cursor position
      setTimeout(() => {
        if (inputRef.current) {
          let nonCommaCount = 0;
          let newPos = 0;
          for (let i = 0; i < (originalCursorPosition ?? 0); i++) {
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
          label={label}
          error={error}
          helperText={helperText}
          ref={inputRef}
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
        {max !== undefined && (
          <div className="flex gap-2 mt-2" role="group" aria-label="Quick fill amount">
            {[25, 50, 75, 100].map((percent) => (
              <button
                key={percent}
                type="button"
                onClick={() => {
                  const factor = Math.pow(10, precision);
                  const calculatedValue = Math.floor((max * percent) / 100 * factor) / factor;
                  if (onQuickFill) {
                    onQuickFill(percent, calculatedValue);
                  }
                  onChange(calculatedValue);
                }}
                className="text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#2600FF]"
                aria-label={percent === 100 ? 'Fill maximum amount' : `Fill ${percent} percent`}
              >
                {percent === 100 ? 'Max' : `${percent}%`}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
);

AmountInput.displayName = 'AmountInput';
