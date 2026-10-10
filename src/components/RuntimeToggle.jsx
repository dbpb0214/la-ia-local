export function RuntimeToggle({ options, value, onChange, disabled }) {
  return (
    <div
      role="radiogroup"
      aria-label="Runtime"
      className="inline-flex w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-1"
    >
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
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              selected
                ? 'bg-white dark:bg-slate-950 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
