import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatSeconds } from '@/lib/format';

export function PromptBox({ engine, ready, onError }) {
  const [prompt, setPrompt] = useState('');
  const [output, setOutput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [tokens, setTokens] = useState(0);
  const [elapsed, setElapsed] = useState(null);
  const ctrlRef = useRef(null);

  useEffect(() => () => ctrlRef.current?.abort(), []);

  async function run(e) {
    e.preventDefault();
    const text = prompt.trim();
    if (!ready || generating || !text) return;

    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setOutput('');
    setTokens(0);
    setElapsed(0);
    setGenerating(true);
    const t0 = performance.now();
    const timer = setInterval(() => setElapsed(performance.now() - t0), 100);

    try {
      await engine.generate(text, {
        signal: ctrl.signal,
        onToken: (chunk) => {
          if (ctrl.signal.aborted) return;
          setOutput((o) => o + chunk);
          setTokens((n) => n + 1);
        },
      });
    } catch (err) {
      if (!ctrl.signal.aborted) onError(err);
    } finally {
      clearInterval(timer);
      setElapsed(performance.now() - t0);
      setGenerating(false);
    }
  }

  const disabled = !ready || generating;

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
      <form onSubmit={run} className="flex gap-2">
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={disabled}
          placeholder="Ask something…"
          aria-label="Prompt"
          aria-describedby={!ready ? 'prompt-help' : undefined}
          className="flex-1 dark:bg-slate-950 dark:border-slate-700"
        />
        {generating ? (
          <Button type="button" variant="ghost" onClick={() => ctrlRef.current?.abort()} className="border border-slate-200 dark:border-slate-700 dark:hover:bg-slate-800">
            Cancel
          </Button>
        ) : (
          <Button type="submit" disabled={disabled || !prompt.trim()} className="dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200">
            Run
          </Button>
        )}
      </form>
      {!ready && (
        <p id="prompt-help" className="text-xs text-slate-500 dark:text-slate-400">
          Download the model to enable
        </p>
      )}

      {elapsed != null && (
        <>
          <div aria-live="polite" className="min-h-[3rem] whitespace-pre-wrap rounded-md bg-slate-100 dark:bg-slate-950 p-3 text-sm">
            {output}
            {generating && <span className="animate-pulse">▍</span>}
          </div>
          <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
            {tokens} tokens streamed · {formatSeconds(elapsed)}
            {generating ? ' · generating…' : ''}
          </p>
        </>
      )}
    </section>
  );
}
