import React from "react";
import { cn } from "./utils";

export interface AmountInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  label?: string;
  decimals?: number;
  symbol?: string;
  max?: string | number;
  onMax?: () => void;
  error?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onValueChange?: (value: string) => void;
}

export const AmountInput = React.forwardRef<HTMLInputElement, AmountInputProps>(
  (
    {
      id: customId,
      className,
      label,
      decimals,
      symbol,
      max,
      onMax,
      error,
      value,
      onChange,
      onValueChange,
      placeholder,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const id = customId || generatedId;
    const errorId = `${id}-error`;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;

      if (decimals !== undefined && val.includes(".")) {
        const parts = val.split(".");
        if (parts[1] && parts[1].length > decimals) {
          return;
        }
      }

      onChange?.(e);
      onValueChange?.(val);
    };

    return (
      <div className="w-full space-y-1.5">
        {(label || onMax || max !== undefined) && (
          <div className="flex items-center justify-between text-xs font-medium">
            {label ? (
              <label htmlFor={id} className="mut">
                {label}
              </label>
            ) : (
              <span />
            )}
            {onMax && (
              <button
                type="button"
                onClick={onMax}
                disabled={disabled}
                className="cursor-pointer font-semibold text-[var(--acc)] hover:underline disabled:opacity-50"
              >
                Max{max !== undefined ? ` (${max})` : ""}
              </button>
            )}
          </div>
        )}

        <div className="relative flex items-center">
          <input
            id={id}
            ref={ref}
            type="text"
            inputMode="decimal"
            value={value}
            disabled={disabled}
            placeholder={placeholder}
            onChange={handleChange}
            aria-invalid={Boolean(error) ? "true" : undefined}
            aria-describedby={error ? errorId : undefined}
            aria-label={!label && placeholder ? placeholder : undefined}
            className={cn(
              "w-full rounded-[10px] border border-[var(--line)] bg-[#0a1020] px-3 py-2 text-base text-[var(--fg)] placeholder:text-[var(--mut)] focus:border-[var(--acc)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
              Boolean(error) && "border-red-500 focus:border-red-500",
              symbol && "pr-14",
              className
            )}
            {...props}
          />

          {symbol && (
            <div className="pointer-events-none absolute right-3 flex items-center text-xs font-semibold mut">
              {symbol}
            </div>
          )}
        </div>

        {error && (
          <p id={errorId} className="text-xs text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

AmountInput.displayName = "AmountInput";
