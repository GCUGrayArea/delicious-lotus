import React, { useState, useId } from 'react';
import styles from './ColorPicker.module.css';

export interface ColorPickerProps {
  label?: string;
  error?: string;
  helperText?: string;
  value: string;
  onChange: (value: string) => void;
  presets?: string[];
  fullWidth?: boolean;
  className?: string;
  id?: string;
  disabled?: boolean;
}

const DEFAULT_PRESETS = [
  '#2563eb', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#6366f1', // Indigo
];

export const ColorPicker: React.FC<ColorPickerProps> = ({
  label,
  error,
  helperText,
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  fullWidth = false,
  className = '',
  id,
  disabled = false,
}) => {
  const [hexInput, setHexInput] = useState(value);
  const generatedId = useId();
  const pickerId = id || generatedId;
  const hasError = !!error;

  const handleColorChange = (color: string) => {
    setHexInput(color);
    onChange(color);
  };

  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setHexInput(newValue);

    // Validate hex color format
    if (/^#[0-9A-Fa-f]{6}$/.test(newValue)) {
      onChange(newValue);
    }
  };

  const handleHexInputBlur = () => {
    // Ensure valid format on blur
    if (!/^#[0-9A-Fa-f]{6}$/.test(hexInput)) {
      setHexInput(value);
    }
  };

  const containerClasses = [
    styles.container,
    fullWidth && styles.fullWidth,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClasses}>
      {label && (
        <label htmlFor={pickerId} className={styles.label}>
          {label}
        </label>
      )}

      <div className={styles.pickerWrapper}>
        {/* Color Preview and Native Picker */}
        <div className={styles.inputGroup}>
          <label htmlFor={`${pickerId}-native`} className={styles.colorPreview}>
            <input
              type="color"
              id={`${pickerId}-native`}
              value={value}
              onChange={(e) => handleColorChange(e.target.value)}
              disabled={disabled}
              className={styles.nativeColorInput}
              aria-label="Color picker"
            />
            <div
              className={styles.colorSwatch}
              style={{ backgroundColor: value }}
              aria-hidden="true"
            />
          </label>

          {/* Hex Input */}
          <input
            type="text"
            id={pickerId}
            value={hexInput}
            onChange={handleHexInputChange}
            onBlur={handleHexInputBlur}
            placeholder="#000000"
            maxLength={7}
            disabled={disabled}
            className={`${styles.hexInput} ${hasError ? styles.hexInputError : ''}`}
            aria-invalid={hasError}
            aria-describedby={
              error
                ? `${pickerId}-error`
                : helperText
                ? `${pickerId}-helper`
                : undefined
            }
          />
        </div>

        {/* Preset Colors */}
        {presets.length > 0 && (
          <div className={styles.presets}>
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleColorChange(preset)}
                disabled={disabled}
                className={`${styles.presetButton} ${preset === value ? styles.presetButtonActive : ''}`}
                style={{ backgroundColor: preset }}
                aria-label={`Select color ${preset}`}
                title={preset}
              />
            ))}
          </div>
        )}
      </div>

      {error && (
        <p id={`${pickerId}-error`} className={styles.errorMessage} role="alert">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={`${pickerId}-helper`} className={styles.helperText}>
          {helperText}
        </p>
      )}
    </div>
  );
};

ColorPicker.displayName = 'ColorPicker';
