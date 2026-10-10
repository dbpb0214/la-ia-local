import { forwardRef } from 'react';

const Button = forwardRef(({ className = '', variant, size, ...props }, ref) => {
  const baseStyles = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50';

  const variantStyles = variant === 'ghost'
    ? 'btn-outline'
    : 'bg-primary text-primary-foreground shadow hover:brightness-90';

  const sizeStyles = size === 'icon' ? 'h-9 w-9' : size === 'lg' ? 'h-11 px-5 text-base' : 'h-9 px-4 py-2';

  return (
    <button
      ref={ref}
      className={`${baseStyles} ${variantStyles} ${sizeStyles} ${className}`}
      {...props}
    />
  );
});

Button.displayName = 'Button';

export { Button };
