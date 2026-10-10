import { Button } from '@/components/ui/button';
import { formatMB, formatPercent, toJson } from '@/lib/format';

const PHASE_LABELS = {
  downloading: 'Downloading',
  initializing: 'Compiling shaders / initializing',
  ready: 'Ready',
};

const BUTTON_LABELS = {
  idle: 'Download model',
  downloading: 'Downloading…',
  initializing: 'Downloading…',
  ready: 'Model ready',
  error: 'Retry download',
};

export function DownloadPanel({ runtimeLabel, model, load, onDownload, onCancel }) {
  const busy = load.status === 'downloading' || load.status === 'initializing';
  const known = load.percent != null;

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-slate-500 dark:text-slate-400">Runtime</dt>
        <dd>{runtimeLabel}</dd>
        <dt className="text-slate-500 dark:text-slate-400">Model</dt>
        <dd className="font-mono text-xs leading-5 break-all">{model.modelId}</dd>
        <dt className="text-slate-500 dark:text-slate-400">Approx. size</dt>
        <dd>
          {model.approxMB != null ? `~${model.approxMB} MB` : 'unknown'}
          {model.approxMBFallback != null && ` (or ~${model.approxMBFallback} MB on GPUs without shader-f16)`}
        </dd>
        {load.info && (
          <>
            <dt className="text-slate-500 dark:text-slate-400">Backend</dt>
            <dd>
              {[load.info.backend, load.info.dtype].filter(Boolean).join(' / ')}
              {load.info.shaderF16 != null && ` · shader-f16: ${load.info.shaderF16}`}
              {load.info.crossOriginIsolated != null && ` · crossOriginIsolated: ${load.info.crossOriginIsolated}`}
              {load.info.fromCache && <span className="font-semibold"> · Loaded from cache</span>}
            </dd>
          </>
        )}
      </dl>

      <div className="flex gap-2">
        <Button
          onClick={onDownload}
          disabled={busy || load.status === 'ready'}
          className="flex-1 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {BUTTON_LABELS[load.status]}
        </Button>
        {busy && (
          <Button variant="ghost" onClick={onCancel} className="border border-slate-200 dark:border-slate-700 dark:hover:bg-slate-800">
            Cancel
          </Button>
        )}
      </div>

      {load.status !== 'idle' && (
        <div className="space-y-2">
          {known ? (
            <div
              role="progressbar"
              aria-label="Model download"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(load.percent)}
              className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
            >
              <div className="h-full bg-slate-900 dark:bg-slate-100 transition-[width]" style={{ width: `${load.percent}%` }} />
            </div>
          ) : (
            // Indeterminate: total unknown, so no aria-valuenow.
            <div role="progressbar" aria-label="Model download" className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div className="h-full w-full animate-pulse bg-slate-400 dark:bg-slate-500" />
            </div>
          )}

          <p className="text-sm tabular-nums">
            {!known
              ? `${formatMB(load.bytesLoaded)} downloaded`
              : load.bytesTotal
                ? `${formatMB(load.bytesLoaded)} of ${formatMB(load.bytesTotal)} · ${formatPercent(load.percent)}`
                : formatPercent(load.percent)}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400" aria-live="polite">
            {PHASE_LABELS[load.phase] ?? load.phase ?? '—'}
            {load.currentFile && <span className="font-mono text-xs"> · {load.currentFile}</span>}
          </p>

          <details className="text-sm">
            <summary className="cursor-pointer select-none text-slate-600 dark:text-slate-400">
              Raw progress events ({load.milestones.length} milestones, {load.events.length} byte updates)
            </summary>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Milestones: all, newest first</p>
            <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-slate-100 dark:bg-slate-950 p-2 font-mono text-xs">
              {load.milestones.map((e) => toJson(e)).join('\n')}
            </pre>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Byte updates: sampled every 250 ms, last 50, newest first
            </p>
            <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-slate-100 dark:bg-slate-950 p-2 font-mono text-xs">
              {load.events.map((e) => toJson(e)).join('\n')}
            </pre>
          </details>
        </div>
      )}
    </section>
  );
}
