import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '../utils';

export type ButtonProps = {
  theme?: 'light' | 'dark';
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
} & ComponentPropsWithoutRef<'button'>;

export function Button({ theme, variant = 'primary', className, disabled, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'py-1 px-4 rounded shadow transition-all',
        {
          // Primary variant
          'bg-blue-500 hover:bg-blue-600 text-white hover:scale-105': variant === 'primary' && !disabled,
          'bg-gray-500 text-gray-700 cursor-not-allowed': variant === 'primary' && disabled,

          // Secondary variant
          'bg-gray-100 hover:bg-gray-200 text-gray-800 hover:scale-105': variant === 'secondary' && !disabled,
          'bg-gray-500 text-gray-700 cursor-not-allowed': variant === 'secondary' && disabled,

          // Danger variant
          'bg-red-500 hover:bg-red-600 text-white hover:scale-105': variant === 'danger' && !disabled,
          'bg-red-300 text-red-100 cursor-not-allowed': variant === 'danger' && disabled,
        },
        className,
      )}
      disabled={disabled}
      {...props}>
      {children}
    </button>
  );
}
