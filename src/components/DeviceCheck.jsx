import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, RefreshCw, XCircle } from 'lucide-react';
import { CopyButton } from '@/components/CopyButton';
import { formatMB, formatSize, toJson } from '@/lib/format';

// Each probe is isolated: a throw records { error } for that key only.
async function runChecks() {
  const report = { timestamp: new Date().toISOString() };
  const probe = async (key, fn) => {
    try {
      report[key] = await fn();
    } catch (e) {
      report[key] = { error: e?.message ?? String(e) };
    }
  };

  let adapter = null;
  await probe('isSecureContext', () => window.isSecureContext);
  await probe('crossOriginIsolated', () => window.crossOriginIsolated);
  await probe('webgpu', () => !!navigator.gpu);
  await probe('adapter', async () => {
    if (!navigator.gpu) return null;
    adapter = await navigator.gpu.requestAdapter();
    return adapter ? 'success' : null;
  });
  await probe('adapterInfo', async () => {
    if (!adapter) return null;
    const info = adapter.info ?? (await adapter.requestAdapterInfo?.());
    if (!info) return null;
    return { vendor: info.vendor, architecture: info.architecture, description: info.description };
  });
  await probe('shaderF16', () => (adapter ? adapter.features.has('shader-f16') : null));
  await probe('limits', () =>
    adapter
      ? {
          maxBufferSize: adapter.limits.maxBufferSize,
          maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
        }
      : null
  );
  await probe('hardwareConcurrency', () => navigator.hardwareConcurrency ?? null);
  await probe('deviceMemoryGB', () => navigator.deviceMemory ?? null);
  await probe('userAgent', () => navigator.userAgent);
  await probe('storage', async () => {
    if (!navigator.storage?.estimate) return null;
    const { usage, quota } = await navigator.storage.estimate();
    return { usage, quota };
  });
  return report;
}

function toRows(r) {
  const row = (label, value, judge) => {
    const [status, text] = value?.error ? ['fail', `Error: ${value.error}`] : judge(value);
    return { label, status, text };
  };
  return [
    row('isSecureContext', r.isSecureContext, (v) => (v ? ['ok', 'true'] : ['fail', 'false (needs HTTPS or localhost)'])),
    row('crossOriginIsolated', r.crossOriginIsolated, (v) =>
      v ? ['ok', 'true'] : ['warn', 'false (no SharedArrayBuffer, WASM threads off)']
    ),
    row('navigator.gpu', r.webgpu, (v) => (v ? ['ok', 'present'] : ['fail', 'missing'])),
    row('requestAdapter()', r.adapter, (v) => (v ? ['ok', 'success'] : ['fail', 'null'])),
    row('Adapter info', r.adapterInfo, (v) =>
      v
        ? ['ok', [v.vendor, v.architecture, v.description].filter(Boolean).join(' · ') || '(empty)']
        : ['warn', 'unavailable']
    ),
    row('shader-f16', r.shaderF16, (v) =>
      v === true ? ['ok', 'supported'] : v === false ? ['warn', 'not supported'] : ['warn', 'n/a (no adapter)']
    ),
    row('maxBufferSize', r.limits, (v) => (v ? ['ok', formatSize(v.maxBufferSize)] : ['warn', 'n/a'])),
    row('maxStorageBufferBindingSize', r.limits, (v) =>
      v ? ['ok', formatSize(v.maxStorageBufferBindingSize)] : ['warn', 'n/a']
    ),
    row('hardwareConcurrency', r.hardwareConcurrency, (v) => (v ? ['ok', `${v} threads`] : ['warn', 'unavailable'])),
    row('deviceMemory', r.deviceMemoryGB, (v) => (v != null ? ['ok', `${v} GB (coarse)`] : ['warn', 'unavailable'])),
    row('userAgent', r.userAgent, (v) => ['info', v ?? 'unavailable']),
    row('storage.estimate()', r.storage, (v) =>
      v ? ['ok', `${formatMB(v.usage)} used of ${formatMB(v.quota)}`] : ['warn', 'unavailable']
    ),
  ];
}

function verdict(r) {
  if (r.isSecureContext !== true) return { status: 'fail', text: 'Insecure context' };
  if (r.adapter === 'success') return { status: 'ok', text: 'WebGPU ready' };
  return { status: 'warn', text: 'WebGPU unavailable (WASM fallback only)' };
}

const INDICATOR = {
  ok: { Icon: CheckCircle2, text: 'OK', cls: 'text-emerald-600 dark:text-emerald-400' },
  warn: { Icon: AlertTriangle, text: 'Warn', cls: 'text-amber-600 dark:text-amber-400' },
  fail: { Icon: XCircle, text: 'Fail', cls: 'text-red-600 dark:text-red-400' },
  info: { Icon: Info, text: 'Info', cls: 'text-slate-500 dark:text-slate-400' },
};

function Indicator({ status }) {
  const { Icon, text, cls } = INDICATOR[status];
  return (
    <span className={`inline-flex w-16 shrink-0 items-center gap-1 text-xs font-semibold ${cls}`}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      {text}
    </span>
  );
}

export function DeviceCheck() {
  const [report, setReport] = useState(null);
  const [running, setRunning] = useState(false);

  const check = useCallback(async () => {
    setRunning(true);
    setReport(await runChecks());
    setRunning(false);
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const v = report && verdict(report);

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Check device</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={check}
            disabled={running}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${running ? 'animate-spin' : ''}`} />
            Re-run check
          </button>
          {report && <CopyButton label="Copy report" getText={() => toJson(report)} />}
        </div>
      </div>

      {!report ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Checking…</p>
      ) : (
        <>
          <p className="mt-3 flex items-center gap-2 text-base font-semibold">
            <Indicator status={v.status} />
            {v.text}
          </p>
          <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            {toRows(report).map((r) => (
              <li key={r.label} className="grid grid-cols-[4rem_1fr] items-start gap-x-3 py-1.5 sm:grid-cols-[4rem_14rem_1fr]">
                <Indicator status={r.status} />
                <span className="font-mono text-xs leading-5 text-slate-600 dark:text-slate-400">{r.label}</span>
                <span className="col-start-2 min-w-0 break-words sm:col-start-auto">{r.text}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
