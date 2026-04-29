import React, { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

interface BaseProps {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  fullWidth?: boolean;
  containerClassName?: string;
}

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement>, BaseProps {
  multiline?: false;
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, BaseProps {
  multiline: true;
  rows?: number;
}

type InputProps = TextInputProps | TextAreaProps;

export const Input = React.forwardRef<HTMLInputElement | HTMLTextAreaElement, InputProps>(
  (props, ref) => {
    const {
      label,
      error,
      helperText,
      required,
      fullWidth = true,
      className,
      containerClassName,
      id,
      multiline,
      ...rest
    } = props;

    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    const baseInputStyles = cn(
      'w-full px-4 py-2.5 rounded-lg border transition-all duration-200 outline-none text-sm',
      'bg-white text-gray-900 placeholder:text-gray-400',
      error
        ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500'
        : 'border-gray-300 focus:border-[#2600FF] focus:ring-1 focus:ring-[#2600FF]',
      props.disabled && 'bg-gray-50 text-gray-500 border-gray-200 cursor-not-allowed',
      className
    );

    return (
      <div className={cn('flex flex-col gap-1.5', fullWidth ? 'w-full' : 'w-auto', containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-gray-700 flex items-center gap-1"
          >
            {label}
            {required && <span className="text-red-500" aria-hidden="true">*</span>}
          </label>
        )}

        {multiline ? (
          <textarea
            id={inputId}
            ref={ref as React.ForwardedRef<HTMLTextAreaElement>}
            className={cn(baseInputStyles, 'resize-none')}
            required={required}
            {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        ) : (
          <input
            id={inputId}
            ref={ref as React.ForwardedRef<HTMLInputElement>}
            className={baseInputStyles}
            required={required}
            {...(rest as InputHTMLAttributes<HTMLInputElement>)}
          />
        )}

        {error ? (
          <p className="text-xs text-red-500 mt-0.5" id={`${inputId}-error`}>
            {error}
          </p>
        ) : helperText ? (
          <p className="text-xs text-gray-500 mt-0.5" id={`${inputId}-helper`}>
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
