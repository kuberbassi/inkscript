import React, { useRef } from 'react';
import { StudioThemeTokens } from '../../constants/studioTokens';
import GlideSelect, { GlideSelectOption } from '../reactbits/GlideSelect';

export interface CustomizerCardProps {
  icon: string;
  title: string;
  badge?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

export const CustomizerCard: React.FC<CustomizerCardProps> = ({
  icon,
  title,
  badge,
  headerActions,
  children
}) => (
  <div className="customizer-card">
    <div className="customizer-card-header">
      <div className="customizer-card-title">
        <i className={`ph ${icon}`}></i>
        <span>{title}</span>
      </div>
      {headerActions ?? (badge ? <span className="customizer-badge">{badge}</span> : null)}
    </div>
    <div className="customizer-card-body">{children}</div>
  </div>
);

export interface PropSelectFieldProps {
  label: string;
  value: string;
  options: GlideSelectOption[];
  tokens: StudioThemeTokens;
  menuWidth?: number;
  disabled?: boolean;
  ariaLabel?: string;
  onChange?: (value: string) => void;
}

export const PropSelectField: React.FC<PropSelectFieldProps> = ({
  label,
  value,
  options,
  tokens,
  menuWidth = 210,
  disabled = false,
  ariaLabel,
  onChange
}) => (
  <div className="prop-cell">
    <span className="prop-label">{label}</span>
    <div className="prop-control">
      <GlideSelect
        options={options}
        value={value}
        onChange={onChange}
        disabled={disabled}
        surfaceColor={tokens.surfaceChip}
        highlightColor={tokens.highlightChip}
        textColor={tokens.textChip}
        accentColor={tokens.accentChip}
        size="sm"
        radius={8}
        menuWidth={menuWidth}
        align="right"
        ariaLabel={ariaLabel ?? label}
      />
    </div>
  </div>
);

export interface PropSwitchFieldProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
}

export const PropSwitchField: React.FC<PropSwitchFieldProps> = ({
  label,
  checked,
  onToggle
}) => (
  <div className="prop-cell">
    <span className="prop-label">{label}</span>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="notion-switch"
      data-checked={checked ? 'true' : 'false'}
      onClick={onToggle}
    >
      <span className="notion-switch-thumb" />
    </button>
  </div>
);

export interface PropFileActionFieldProps {
  label: string;
  accept: string;
  icon: string;
  buttonText: string;
  hasActiveValue?: boolean;
  onSelectFile: (file: File) => void;
  onClear?: () => void;
}

export const PropFileActionField: React.FC<PropFileActionFieldProps> = ({
  label,
  accept,
  icon,
  buttonText,
  hasActiveValue = false,
  onSelectFile,
  onClear
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSelectFile(file);
    }
  };

  const handleClear = () => {
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    onClear?.();
  };

  return (
    <div className="prop-cell">
      <span className="prop-label">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          accept={accept}
          type="file"
          className="hidden"
          onChange={handleChange}
        />
        {hasActiveValue && onClear && (
          <button
            type="button"
            className="notion-chip-btn danger"
            onClick={handleClear}
          >
            Reset
          </button>
        )}
        <button
          type="button"
          className="notion-chip-btn"
          onClick={() => inputRef.current?.click()}
        >
          <i className={`ph ${icon}`}></i>
          <span>{buttonText}</span>
        </button>
      </div>
    </div>
  );
};
