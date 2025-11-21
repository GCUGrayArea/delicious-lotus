import React, { useId } from 'react';
import styles from './Radio.module.css';

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface RadioProps {
  label?: string;
  error?: string;
  helperText?: string;
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
  name: string;
  orientation?: 'horizontal' | 'vertical';
  fullWidth?: boolean;
  className?: string;
}

export const Radio: React.FC<RadioProps> = ({
  label,
  error,
  helperText,
  options,
  value,
  onChange,
  name,
  orientation = 'vertical',
  fullWidth = false,
  className = '',
}) => {
  const groupId = useId();
  const hasError = !!error;

  const containerClasses = [
    styles.container,
    fullWidth && styles.fullWidth,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const optionsClasses = [
    styles.options,
    orientation === 'horizontal' && styles.optionsHorizontal,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClasses}>
      {label && (
        <div className={styles.label} id={groupId}>
          {label}
        </div>
      )}
      <div
        className={optionsClasses}
        role="radiogroup"
        aria-labelledby={label ? groupId : undefined}
        aria-invalid={hasError}
        aria-describedby={
          error
            ? `${groupId}-error`
            : helperText
            ? `${groupId}-helper`
            : undefined
        }
      >
        {options.map((option) => {
          const optionId = `${name}-${option.value}`;
          const isSelected = value === option.value;

          const optionClasses = [
            styles.option,
            isSelected && styles.optionSelected,
            option.disabled && styles.optionDisabled,
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <label key={option.value} htmlFor={optionId} className={optionClasses}>
              <input
                type="radio"
                id={optionId}
                name={name}
                value={option.value}
                checked={isSelected}
                disabled={option.disabled}
                onChange={(e) => onChange(e.target.value)}
                className={styles.input}
              />
              <div className={styles.radioButton}>
                <div className={styles.radioButtonInner} />
              </div>
              <div className={styles.content}>
                <div className={styles.optionLabel}>{option.label}</div>
                {option.description && (
                  <div className={styles.optionDescription}>{option.description}</div>
                )}
              </div>
            </label>
          );
        })}
      </div>
      {error && (
        <p id={`${groupId}-error`} className={styles.errorMessage} role="alert">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={`${groupId}-helper`} className={styles.helperText}>
          {helperText}
        </p>
      )}
    </div>
  );
};

Radio.displayName = 'Radio';
