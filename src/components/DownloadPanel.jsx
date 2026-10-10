import { Button } from '@/components/ui/button';
import { formatMB, formatPercent, toJson } from '@/lib/format';

const PHASE_LABELS = {
  downloading: ['Downloading', 'Descargando'],
  initializing: ['Getting AI ready…', 'Preparando la IA…'],
  ready: ['Ready', 'Lista'],
};

const BUTTON_LABELS = {
  idle: ['Download AI for Translation', 'Descargar IA para traducción'],
  downloading: ['Downloading…', 'Descargando…'],
  initializing: ['Downloading…', 'Descargando…'],
  ready: ['AI ready', 'IA lista'],
  error: ['Retry download', 'Reintentar descarga'],
};

export function DownloadPanel({ runtimeLabel, model, load, onDownload, onCancel, t }) {
  const busy = load.status === 'downloading' || load.status === 'initializing';
  const known = load.percent != null;

  return (
    <section className="rounded-xl border border-border bg-white p-4 space-y-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Runtime</dt>
        <dd>{runtimeLabel}</dd>
        <dt className="text-muted-foreground">Model</dt>
        <dd className="font-mono text-xs leading-5 break-all">{model.modelId}</dd>
        <dt className="text-muted-foreground">Approx. size</dt>
        <dd>
          {model.approxMB != null ? `~${model.approxMB} MB` : 'unknown'}
          {model.approxMBFallback != null && ` (or ~${model.approxMBFallback} MB on GPUs without shader-f16)`}
        </dd>
        {load.info && (
          <>
            <dt className="text-muted-foreground">Backend</dt>
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
          size="lg"
          disabled={busy || load.status === 'ready'}
          className="flex-1"
        >
          {t(...BUTTON_LABELS[load.status])}
        </Button>
        {busy && (
          <Button variant="ghost" onClick={onCancel}>
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
              className="h-2 overflow-hidden rounded-full bg-muted"
            >
              <div className="h-full bg-primary transition-[width]" style={{ width: `${load.percent}%` }} />
            </div>
          ) : (
            // Indeterminate: total unknown, so no aria-valuenow.
            <div role="progressbar" aria-label="Model download" className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-full animate-pulse bg-primary/40" />
            </div>
          )}

          <p className="text-sm tabular-nums">
            {!known
              ? `${formatMB(load.bytesLoaded)} downloaded`
              : load.bytesTotal
                ? `${formatMB(load.bytesLoaded)} of ${formatMB(load.bytesTotal)} · ${formatPercent(load.percent)}`
                : formatPercent(load.percent)}
          </p>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {PHASE_LABELS[load.phase] ? t(...PHASE_LABELS[load.phase]) : (load.phase ?? '—')}
            {load.currentFile && <span className="font-mono text-xs"> · {load.currentFile}</span>}
          </p>

          <details className="text-sm">
            <summary className="cursor-pointer select-none text-muted-foreground">
              Raw progress events ({load.milestones.length} milestones, {load.events.length} byte updates)
            </summary>
            <p className="mt-2 text-xs text-muted-foreground">Milestones: all, newest first</p>
            <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-muted p-2 font-mono text-xs">
              {load.milestones.map((e) => toJson(e)).join('\n')}
            </pre>
            <p className="mt-2 text-xs text-muted-foreground">
              Byte updates: sampled every 250 ms, last 50, newest first
            </p>
            <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-muted p-2 font-mono text-xs">
              {load.events.map((e) => toJson(e)).join('\n')}
            </pre>
          </details>
        </div>
      )}
    </section>
  );
}
