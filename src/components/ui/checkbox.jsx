import { forwardRef } from 'react';
import { Check } from 'lucide-react';

const Checkbox = forwardRef(({ className = '', checked, onCheckedChange, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    role="checkbox"
    aria-checked={checked}
    onClick={() => onCheckedChange?.(!checked)}
    className={`h-4 w-4 shrink-0 rounded-sm border border-border shadow-sm flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'bg-primary text-primary-foreground border-primary' : 'bg-white'} ${className}`}
    {...props}
  >
    {checked && <Check className="h-3 w-3" />}
  </button>
));

Checkbox.displayName = 'Checkbox';

export { Checkbox };
