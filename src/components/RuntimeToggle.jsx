import { Check } from 'lucide-react';

export function RuntimeToggle({ options, value, onChange, disabled, label = 'Runtime' }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex w-full gap-2">
      {options.map((opt) => {
        const selected = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(opt.id)}
            className={`inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md border-[1.5px] border-primary px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              selected ? 'bg-primary text-primary-foreground shadow' : 'bg-white text-primary hover:bg-accent'
            }`}
          >
            {selected && <Check className="h-4 w-4" aria-hidden="true" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
