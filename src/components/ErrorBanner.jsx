import { XCircle } from 'lucide-react';
import { CopyButton } from '@/components/CopyButton';

export function ErrorBanner({ error, onDismiss }) {
  if (!error) return null;
  return (
    <div role="alert" className="rounded-xl border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/50 p-4 text-sm text-red-900 dark:text-red-200">
      <div className="flex items-start gap-2">
        <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {error.code === 'WEBGPU_REQUIRED'
              ? 'WebGPU required (WASM fallback not implemented yet)'
              : `Error during ${error.phase ?? 'unknown phase'}`}
          </p>
          <p className="mt-1 break-words font-mono text-xs">{error.message}</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <CopyButton label="Copy error" getText={() => `[${error.phase}${error.code ? ` ${error.code}` : ''}] ${error.message}`} />
        <button type="button" onClick={onDismiss} className="rounded-md px-2.5 py-1 text-xs font-medium hover:underline">
          Dismiss
        </button>
      </div>
    </div>
  );
}
