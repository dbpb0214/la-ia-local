import { lazy, Suspense, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { DeviceCheck } from '@/components/DeviceCheck';
import { RuntimeToggle } from '@/components/RuntimeToggle';
import { DownloadPanel } from '@/components/DownloadPanel';
import { PromptBox } from '@/components/PromptBox';
import { ErrorBanner } from '@/components/ErrorBanner';
import { MODELS, getEngine } from '@/engines';
import { MOCK_MODEL } from '@/engines/mock.engine';

// Lazy: pulls in pdfjs-dist + pdf-lib (~320 KB gz), only needed for the Anonymize runtime.
const QaPanel = lazy(() => import('@/components/QaPanel').then((m) => ({ default: m.QaPanel })));
const AnonymizePanel = lazy(() => import('@/components/AnonymizePanel').then((m) => ({ default: m.AnonymizePanel })));
import { initialLoadState, loadReducer } from '@/lib/loadMachine';

const RUNTIME_OPTIONS = Object.entries(MODELS).map(([id, m]) => ({ id, label: m.label }));
const LANG_OPTIONS = [
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
];

export default function App() {
  const [lang, setLang] = useState('en');
  const t = (en, es) => (lang === 'es' ? es : en);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const [runtime, setRuntime] = useState('translation');
  const [useMock, setUseMock] = useState(false);
  const [direction, setDirection] = useState('en>es');
  const [load, dispatch] = useReducer(loadReducer, initialLoadState);
  const abortRef = useRef(null);

  const engine = useMemo(() => getEngine(runtime, { mock: useMock }), [runtime, useMock]);

  // Switching runtime or mock mode: abort any load, drop the old engine, reset to idle.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      engine.dispose();
      dispatch({ type: 'reset' });
    },
    [engine]
  );

  useEffect(() => engine.setDirection?.(direction), [engine, direction]);

  const busy = load.status === 'downloading' || load.status === 'initializing';
  const model = useMock ? MOCK_MODEL : MODELS[runtime];
  const runtimeLabel = MODELS[runtime].label + (useMock ? ' (mock engine)' : '');

  async function startDownload() {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    dispatch({ type: 'start' });
    try {
      await engine.load({
        signal: ctrl.signal,
        onProgress: (payload) => {
          if (!ctrl.signal.aborted) dispatch({ type: 'progress', payload });
        },
      });
      if (!ctrl.signal.aborted) dispatch({ type: 'ready' });
    } catch (err) {
      if (!ctrl.signal.aborted) dispatch({ type: 'fail', message: err?.message ?? String(err), code: err?.code, phase: err?.phase });
    }
  }

  function cancelDownload() {
    abortRef.current?.abort();
    engine.dispose();
    dispatch({ type: 'reset' });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-10">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">La IA local</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Downloads an AI once into this browser, then runs on-device.
          </p>
          <div className="mt-3 space-y-1">
            <p className="text-sm font-medium">English / Spanish Translation</p>
            <RuntimeToggle options={LANG_OPTIONS} value={lang} onChange={setLang} label="English / Spanish Translation" />
          </div>
        </header>

        <div className="space-y-2">
          <RuntimeToggle options={RUNTIME_OPTIONS} value={runtime} onChange={setRuntime} disabled={busy} />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={useMock}
              onCheckedChange={setUseMock}
              disabled={busy}
              aria-label="Use mock engine (UI test)"
              className={useMock ? '' : ''}
            />
            Use mock engine (UI test)
          </label>
        </div>

        <DeviceCheck t={t} />

        <DownloadPanel
          runtimeLabel={runtimeLabel}
          model={model}
          load={load}
          onDownload={startDownload}
          onCancel={cancelDownload}
          t={t}
        />

        {runtime === 'translation' && !useMock && (
          <label className="flex items-center gap-2 text-sm">
            Direction
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              className="rounded-md border border-border bg-white px-2 py-1"
            >
              <option value="en>es">English → Spanish</option>
              <option value="es>en">Spanish → English</option>
            </select>
          </label>
        )}

        {runtime === 'anonymize' ? (
          <Suspense fallback={null}>
            <AnonymizePanel
              key={`${runtime}-${useMock}`}
              engine={engine}
              ready={load.status === 'ready'}
              onError={(err) => dispatch({ type: 'generateError', message: err?.message ?? String(err) })}
            />
          </Suspense>
        ) : runtime === 'qa' ? (
          <Suspense fallback={null}>
            <QaPanel
              key={`${runtime}-${useMock}`}
              engine={engine}
              ready={load.status === 'ready'}
              onError={(err) => dispatch({ type: 'generateError', message: err?.message ?? String(err) })}
            />
          </Suspense>
        ) : (
          <PromptBox
            key={`${runtime}-${useMock}`}
            engine={engine}
            ready={load.status === 'ready'}
            onError={(err) => dispatch({ type: 'generateError', message: err?.message ?? String(err) })}
          />
        )}

        <ErrorBanner error={load.error} onDismiss={() => dispatch({ type: 'clearError' })} t={t} />
      </main>
    </div>
  );
}
