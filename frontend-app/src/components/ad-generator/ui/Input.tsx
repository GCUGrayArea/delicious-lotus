import React, { useId } from 'react';
import styles from './Input.module.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  success?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      success,
      helperText,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className = '',
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const hasError = !!error;
    const hasSuccess = !!success && !error;

    const containerClasses = [
      styles.container,
      fullWidth && styles.fullWidth,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const inputClasses = [
      styles.input,
      leftIcon && styles.inputWithLeftIcon,
      rightIcon && styles.inputWithRightIcon,
      hasError && styles.inputError,
      hasSuccess && styles.inputSuccess,
      disabled && styles.inputDisabled,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={containerClasses}>
        {label && (
          <label htmlFor={inputId} className={styles.label}>
            {label}
          </label>
        )}
        <div className={styles.inputWrapper}>
          {leftIcon && (
            <div className={styles.leftIcon} aria-hidden="true">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={inputClasses}
            disabled={disabled}
            aria-invalid={hasError}
            aria-describedby={
              error
                ? `${inputId}-error`
                : helperText
                ? `${inputId}-helper`
                : undefined
            }
            {...props}
          />
          {rightIcon && (
            <div className={styles.rightIcon} aria-hidden="true">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p id={`${inputId}-error`} className={styles.errorMessage} role="alert">
            {error}
          </p>
        )}
        {success && !error && (
          <p id={`${inputId}-success`} className={styles.successMessage}>
            {success}
          </p>
        )}
        {helperText && !error && !success && (
          <p id={`${inputId}-helper`} className={styles.helperText}>
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
