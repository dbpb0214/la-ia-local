import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { DeviceCheck } from '@/components/DeviceCheck';
import { RuntimeToggle } from '@/components/RuntimeToggle';
import { DownloadPanel } from '@/components/DownloadPanel';
import { PromptBox } from '@/components/PromptBox';
import { ErrorBanner } from '@/components/ErrorBanner';
import { MODELS, getEngine } from '@/engines';
import { MOCK_MODEL } from '@/engines/mock.engine';
import { initialLoadState, loadReducer } from '@/lib/loadMachine';

const RUNTIME_OPTIONS = Object.entries(MODELS).map(([id, m]) => ({ id, label: m.label }));

export default function App() {
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
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-10">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Local AI spike</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            The model downloads once into this browser, then runs on-device.
          </p>
        </header>

        <div className="space-y-2">
          <RuntimeToggle options={RUNTIME_OPTIONS} value={runtime} onChange={setRuntime} disabled={busy} />
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Checkbox
              checked={useMock}
              onCheckedChange={setUseMock}
              disabled={busy}
              aria-label="Use mock engine (UI test)"
              className={useMock ? 'dark:bg-slate-100 dark:text-slate-900' : 'dark:bg-slate-900 dark:border-slate-600'}
            />
            Use mock engine (UI test)
          </label>
        </div>

        <DeviceCheck />

        <DownloadPanel
          runtimeLabel={runtimeLabel}
          model={model}
          load={load}
          onDownload={startDownload}
          onCancel={cancelDownload}
        />

        {runtime === 'translation' && !useMock && (
          <label className="flex items-center gap-2 text-sm">
            Direction
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1"
            >
              <option value="en>es">English → Spanish</option>
              <option value="es>en">Spanish → English</option>
            </select>
          </label>
        )}

        <PromptBox
          key={`${runtime}-${useMock}`}
          engine={engine}
          ready={load.status === 'ready'}
          onError={(err) => dispatch({ type: 'generateError', message: err?.message ?? String(err) })}
        />

        <ErrorBanner error={load.error} onDismiss={() => dispatch({ type: 'clearError' })} />
      </main>
    </div>
  );
}
