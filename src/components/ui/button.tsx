import React from 'react';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'xs' | 'sm' | 'md';

const variantMap: Record<ButtonVariant, string> = {
  primary: 'bg-slate-900 text-white hover:bg-slate-800 border border-slate-900 shadow-2xs',
  accent: 'bg-[#4A6CF7] text-white hover:bg-[#3451D1] border border-[#4A6CF7] shadow-2xs',
  secondary: 'bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/90 shadow-2xs',
  ghost: 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent',
  danger: 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200',
};

const sizeMap: Record<ButtonSize, string> = {
  xs: 'px-2.5 py-1 text-[11px] rounded-md gap-1',
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-4 py-2 text-[13px] rounded-lg gap-2',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.memo(function Button({
  variant = 'secondary',
  size = 'sm',
  className = '',
  type = 'button',
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center font-semibold whitespace-nowrap transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${variantMap[variant]} ${sizeMap[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});
