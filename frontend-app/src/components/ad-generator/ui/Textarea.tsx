import React, { useId } from 'react';
import styles from './Textarea.module.css';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  showCounter?: boolean;
  fullWidth?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helperText,
      showCounter = false,
      fullWidth = false,
      className = '',
      id,
      disabled,
      maxLength,
      value,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const textareaId = id || generatedId;
    const hasError = !!error;
    const charCount = typeof value === 'string' ? value.length : 0;
    const isNearLimit = maxLength && charCount > maxLength * 0.9;
    const isOverLimit = maxLength && charCount > maxLength;

    const containerClasses = [
      styles.container,
      fullWidth && styles.fullWidth,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const textareaClasses = [
      styles.textarea,
      hasError && styles.textareaError,
      disabled && styles.textareaDisabled,
    ]
      .filter(Boolean)
      .join(' ');

    const counterClasses = [
      styles.counter,
      isNearLimit && styles.counterWarning,
      isOverLimit && styles.counterError,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={containerClasses}>
        {label && (
          <label htmlFor={textareaId} className={styles.label}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={textareaClasses}
          disabled={disabled}
          maxLength={maxLength}
          value={value}
          aria-invalid={hasError}
          aria-describedby={
            error
              ? `${textareaId}-error`
              : helperText
              ? `${textareaId}-helper`
              : undefined
          }
          {...props}
        />
        {showCounter && maxLength && (
          <div className={counterClasses} aria-live="polite">
            {charCount} / {maxLength}
          </div>
        )}
        {error && (
          <p id={`${textareaId}-error`} className={styles.errorMessage} role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={`${textareaId}-helper`} className={styles.helperText}>
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
