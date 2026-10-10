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

// `t(en, es)` picks the UI language; `tech` = raw API name, shown only in Technical details.
function toRows(r, t) {
  const row = (label, value, judge, tech) => {
    const [status, text] = value?.error ? ['fail', `Error: ${value.error}`] : judge(value);
    return { label, status, text, tech };
  };
  const YES = t('Yes', 'Sí');
  const UNKNOWN = t('Unknown', 'Desconocido');
  return [
    row(t('Secure connection', 'Conexión segura'), r.isSecureContext, (v) =>
      v ? ['ok', YES] : ['fail', t('No: open with https://', 'No: abra con https://')]
    ),
    row(t('Browser can use graphics chip', 'El navegador puede usar el chip gráfico'), r.webgpu, (v) =>
      v ? ['ok', YES] : ['fail', t('No: try Chrome or Edge', 'No: pruebe Chrome o Edge')]
    ),
    row(t('Graphics chip found', 'Chip gráfico encontrado'), r.adapter, (v) => (v ? ['ok', YES] : ['fail', 'No'])),
    row(t('Graphics chip', 'Chip gráfico'), r.adapterInfo, (v) =>
      v ? ['ok', [v.vendor, v.architecture, v.description].filter(Boolean).join(' · ') || UNKNOWN] : ['warn', UNKNOWN]
    ),
    row(t('Processor cores', 'Núcleos del procesador'), r.hardwareConcurrency, (v) =>
      v ? ['ok', t(`${v} cores`, `${v} núcleos`)] : ['warn', UNKNOWN]
    ),
    row(t('Memory (approx.)', 'Memoria (aprox.)'), r.deviceMemoryGB, (v) => (v != null ? ['ok', `${v} GB`] : ['warn', UNKNOWN])),
    row(t('Space for downloads', 'Espacio para descargas'), r.storage, (v) =>
      v
        ? ['ok', t(`${formatMB(v.usage)} used of ${formatMB(v.quota)}`, `${formatMB(v.usage)} usados de ${formatMB(v.quota)}`)]
        : ['warn', UNKNOWN]
    ),
    row(
      t('Multi-core speed boost', 'Aceleración multinúcleo'),
      r.crossOriginIsolated,
      (v) => (v ? ['ok', 'true'] : ['warn', 'false (no SharedArrayBuffer, WASM threads off)']),
      'crossOriginIsolated'
    ),
    row(
      t('Fast math mode', 'Modo de cálculo rápido'),
      r.shaderF16,
      (v) => (v === true ? ['ok', 'supported'] : v === false ? ['warn', 'not supported'] : ['warn', 'n/a (no adapter)']),
      'shader-f16'
    ),
    row(
      t('Largest block of AI data', 'Bloque de datos más grande'),
      r.limits,
      (v) => (v ? ['ok', formatSize(v.maxBufferSize)] : ['warn', 'n/a']),
      'maxBufferSize'
    ),
    row(
      t('Largest working memory block', 'Bloque de memoria de trabajo más grande'),
      r.limits,
      (v) => (v ? ['ok', formatSize(v.maxStorageBufferBindingSize)] : ['warn', 'n/a']),
      'maxStorageBufferBindingSize'
    ),
    row(t('Browser version', 'Versión del navegador'), r.userAgent, (v) => ['info', v ?? 'unavailable'], 'userAgent'),
  ];
}

function verdict(r, t) {
  if (r.isSecureContext !== true)
    return {
      status: 'fail',
      text: t('Open this page with a secure link (https)', 'Abra esta página con un enlace seguro (https)'),
    };
  if (r.adapter === 'success')
    return { status: 'ok', text: t('Ready: AI runs fast on this device', 'Listo: la IA funciona rápido en este equipo') };
  return { status: 'warn', text: t('Works, but slower on this device', 'Funciona, pero más lento en este equipo') };
}

const INDICATOR = {
  ok: { Icon: CheckCircle2, text: ['Good', 'Bueno'], cls: 'text-emerald-600' },
  warn: { Icon: AlertTriangle, text: ['Heads up', 'Atención'], cls: 'text-amber-600' },
  fail: { Icon: XCircle, text: ['Problem', 'Problema'], cls: 'text-red-600' },
  info: { Icon: Info, text: ['Info', 'Info'], cls: 'text-muted-foreground' },
};

function Indicator({ status, t }) {
  const { Icon, text, cls } = INDICATOR[status];
  return (
    <span className={`inline-flex w-24 shrink-0 items-start gap-1 text-xs font-semibold ${cls}`}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      {t(...text)}
    </span>
  );
}

function RowList({ rows, t }) {
  return (
    <ul className="mt-3 divide-y divide-border text-sm">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[6rem_1fr] items-start gap-x-3 py-1.5 sm:grid-cols-[6rem_14rem_1fr]">
          <Indicator status={r.status} t={t} />
          <span className="text-xs leading-5 text-muted-foreground">
            {r.label}
            {r.tech && <span className="block font-mono">{r.tech}</span>}
          </span>
          <span className="col-start-2 min-w-0 break-words sm:col-start-auto">{r.text}</span>
        </li>
      ))}
    </ul>
  );
}

export function DeviceCheck({ t }) {
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

  const v = report && verdict(report, t);
  const rows = report ? toRows(report, t) : [];

  return (
    <section className="rounded-xl border border-border bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{t('Is my device ready?', '¿Mi equipo está listo?')}</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={check}
            disabled={running}
            className="inline-flex items-center gap-1.5 btn-outline px-2.5 py-1 text-xs disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${running ? 'animate-spin' : ''}`} />
            {t('Check again', 'Revisar otra vez')}
          </button>
          {report && <CopyButton label={t('Copy report for support', 'Copiar informe para soporte')} getText={() => toJson(report)} />}
        </div>
      </div>

      {!report ? (
        <p className="mt-3 text-sm text-muted-foreground">{t('Checking…', 'Revisando…')}</p>
      ) : (
        <>
          <p className="mt-3 flex items-center gap-2 text-base font-semibold">
            <Indicator status={v.status} t={t} />
            {v.text}
          </p>
          <RowList rows={rows.filter((r) => !r.tech)} t={t} />
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              {t('Technical details', 'Detalles técnicos')}
            </summary>
            <RowList rows={rows.filter((r) => r.tech)} t={t} />
          </details>
        </>
      )}
    </section>
  );
}
