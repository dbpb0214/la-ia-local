// Dev-only translation harness: open /#translate-harness under `npm run dev` / `base44 dev`.
// Prints raw side-by-side output for human review; makes no quality judgement.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/CopyButton';
import { formatMB, formatPercent, formatSeconds, toJson } from '@/lib/format';
import { ENGINES, pickEngine, translateText, loadGlossary, disposeWorker } from '@/translation';
import { SAMPLES } from '@/translation/samples';

const card = 'rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3';
const heap = () => performance.memory?.usedJSHeapSize; // Chrome-only, main-thread JS heap

export default function Harness() {
  const [dir, setDir] = useState('en>es');
  const [allowExperimental, setAllowExperimental] = useState(false);
  const [force, setForce] = useState('auto');
  const [statuses, setStatuses] = useState({});
  const [progress, setProgress] = useState({});
  const [errors, setErrors] = useState({});
  const [picked, setPicked] = useState(null);
  const [glossary, setGlossary] = useState([]);
  const [results, setResults] = useState({});
  const [running, setRunning] = useState(null);

  const pair = useMemo(() => {
    const [src, tgt] = dir.split('>');
    return { src, tgt };
  }, [dir]);
  const samples = SAMPLES[pair.src];

  const refresh = useCallback(async () => {
    setStatuses(Object.fromEntries(await Promise.all(ENGINES.map(async (e) => [e.id, await e.status(pair)]))));
    const engine = await pickEngine(pair, { force: force === 'auto' ? undefined : force, allowExperimental }).catch(() => null);
    setPicked(engine?.id ?? null);
    setGlossary(await loadGlossary(pair));
  }, [pair, force, allowExperimental]);

  useEffect(() => {
    setResults({});
    setProgress({});
    refresh();
  }, [refresh]);

  // Called from a click: Chrome needs user activation to download a language pack.
  async function init(engine) {
    setErrors((s) => ({ ...s, [engine.id]: null }));
    try {
      await engine.init(pair, (p) => setProgress((s) => ({ ...s, [engine.id]: p })));
    } catch (e) {
      setErrors((s) => ({ ...s, [engine.id]: e?.message ?? String(e) }));
    }
    refresh();
  }

  async function run(engines) {
    for (const engine of engines) {
      const rows = [];
      const log = [];
      let heapPeak = heap();
      const t0 = performance.now();
      for (const [i, sample] of samples.entries()) {
        setRunning(`${engine.label}: sample ${i + 1}/${samples.length}`);
        try {
          const r = await translateText(sample, { ...pair, engine, glossary });
          const ms = r.timings.reduce((a, t) => a + t.ms, 0);
          rows.push({ text: r.text, ms, sentences: r.timings.length });
          log.push(...r.log);
        } catch (e) {
          rows.push({ error: e?.message ?? String(e) });
        }
        heapPeak = Math.max(heapPeak ?? 0, heap() ?? 0) || undefined;
        setResults((s) => ({ ...s, [engine.id]: { rows: [...rows], log: [...log], heapPeak, totalMs: performance.now() - t0 } }));
      }
    }
    setRunning(null);
  }

  async function clearCache() {
    disposeWorker();
    await caches.delete('transformers-cache');
    setProgress({});
    refresh();
  }

  const readyEngines = ENGINES.filter((e) => statuses[e.id]?.state === 'ready');
  const shown = ENGINES.filter((e) => results[e.id]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-10">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Translation harness (dev only)</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Raw output for side-by-side review. No quality scoring.
          </p>
        </header>

        <section className={card}>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              Direction
              <select value={dir} onChange={(e) => setDir(e.target.value)} disabled={!!running} className="rounded-md border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1">
                <option value="en>es">English → Spanish (documents)</option>
                <option value="es>en">Spanish → English (questions)</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              Force engine
              <select value={force} onChange={(e) => setForce(e.target.value)} className="rounded-md border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1">
                <option value="auto">auto (priority order)</option>
                {ENGINES.map((e) => (
                  <option key={e.id} value={e.id}>{e.id}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={allowExperimental} onChange={(e) => setAllowExperimental(e.target.checked)} />
              Allow TranslateGemma (experimental)
            </label>
          </div>
          <p className="text-sm">
            Picked engine: <span className="font-mono">{picked ?? 'none available'}</span>
          </p>
        </section>

        <section className={card}>
          <h2 className="font-semibold">Engines</h2>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            {ENGINES.map((e) => {
              const st = statuses[e.id];
              const p = progress[e.id];
              return (
                <li key={e.id} className="flex flex-wrap items-center gap-3 py-2">
                  <span className="w-72 font-medium">{e.label}</span>
                  <span className="font-mono text-xs">{st?.state ?? '…'}</span>
                  <span className="min-w-0 flex-1 break-words text-xs text-slate-500 dark:text-slate-400">{st?.detail}</span>
                  {p && (
                    <span className="text-xs tabular-nums">
                      {formatPercent(p.percent)}
                      {p.totalBytes ? ` · ${formatMB(p.loadedBytes)} of ${formatMB(p.totalBytes)}` : ''}
                    </span>
                  )}
                  <Button
                    onClick={() => init(e)}
                    disabled={!st || st.state === 'unavailable' || st.state === 'ready' || !!running || (e.experimental && !allowExperimental)}
                    className="h-8 dark:bg-slate-100 dark:text-slate-900"
                  >
                    {st?.state === 'needs-download' ? 'Download & init' : 'Init'}
                  </Button>
                  {errors[e.id] && <p className="basis-full text-xs text-red-600 dark:text-red-400">{errors[e.id]}</p>}
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => run(readyEngines)} disabled={!readyEngines.length || !!running} className="dark:bg-slate-100 dark:text-slate-900">
              Run all ready engines ({readyEngines.length})
            </Button>
            <Button variant="ghost" onClick={clearCache} disabled={!!running} className="border border-slate-200 dark:border-slate-700">
              Clear model cache (Opus/Gemma)
            </Button>
            {shown.length > 0 && <CopyButton label="Copy results JSON" getText={() => toJson({ pair, glossary, samples, results })} />}
          </div>
          {running && <p className="text-sm" aria-live="polite">Running {running}…</p>}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Memory: only main-thread JS heap is shown (performance.memory). Worker and GPU memory are not measurable without
            cross-origin isolation. Chrome language packs are managed by Chrome and not cleared here.
          </p>
        </section>

        <section className={card}>
          <h2 className="font-semibold">Glossary ({dir})</h2>
          <p className="font-mono text-xs">{glossary.map((t) => `${t.src} → ${t.tgt}`).join('  ·  ') || 'none'}</p>
        </section>

        {shown.length > 0 && (
          <section className={`${card} overflow-x-auto`}>
            <h2 className="font-semibold">Results</h2>
            <table className="w-full border-collapse text-left text-xs align-top">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="p-2">#</th>
                  <th className="p-2">Source</th>
                  {shown.map((e) => (
                    <th key={e.id} className="p-2">
                      {e.label}
                      <div className="font-normal text-slate-500 dark:text-slate-400">
                        total {formatSeconds(results[e.id].totalMs)} · heap peak {formatMB(results[e.id].heapPeak)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {samples.map((s, i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-800 align-top">
                    <td className="p-2 tabular-nums">{i + 1}</td>
                    <td className="whitespace-pre-wrap p-2">{s}</td>
                    {shown.map((e) => {
                      const row = results[e.id].rows[i];
                      return (
                        <td key={e.id} className="whitespace-pre-wrap p-2">
                          {!row ? '…' : row.error ? <span className="text-red-600 dark:text-red-400">{row.error}</span> : row.text}
                          {row && !row.error && (
                            <div className="mt-1 tabular-nums text-slate-500 dark:text-slate-400">
                              {Math.round(row.ms)} ms · {row.sentences} sentence{row.sentences === 1 ? '' : 's'} ·{' '}
                              {Math.round(row.ms / row.sentences)} ms/sentence
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.map((e) => (
              <details key={e.id} className="text-sm">
                <summary className="cursor-pointer">Glossary fallbacks: {e.label} ({results[e.id].log.length})</summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-slate-100 dark:bg-slate-950 p-2 font-mono text-xs">
                  {toJson(results[e.id].log)}
                </pre>
              </details>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
