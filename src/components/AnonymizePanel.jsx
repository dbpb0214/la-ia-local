import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { detectPage } from '@/anonymize/detect';
import { label } from '@/anonymize/spans';
import { openPdf, extractPage, boxesFor, renderPage, exportRedacted } from '@/anonymize/pdf';

const PREVIEW_SCALE = 1.5;

// One page: the original with clickable highlight boxes (review), or the final rasterized
// redaction painted on the canvas (preview).
function PageView({ doc, n, page, boxes, disabled, final, onToggle }) {
  const canvasRef = useRef(null);
  const active = useMemo(() => boxes.filter((b) => !disabled.has(b.label)), [boxes, disabled]);
  // A new canvas per render target: pdf.js rejects concurrent renders into one canvas.
  const canvasKey = final ? `final:${active.map((b) => b.label).join()}` : 'plain';

  useEffect(() => {
    renderPage(doc, n, canvasRef.current, PREVIEW_SCALE, final ? active : []).catch((e) => console.error(e));
  }, [doc, n, canvasKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const pct = (v, of) => `${(v / of) * 100}%`;
  return (
    <div className="relative border border-border bg-white">
      <canvas key={canvasKey} ref={canvasRef} className="block w-full h-auto" />
      {!final &&
        boxes.map((b, i) => {
          const on = !disabled.has(b.label);
          return (
            <button
              key={i}
              type="button"
              title={`${b.label} — click to ${on ? 'keep visible' : 'redact'}`}
              aria-label={`${b.label}, ${on ? 'redacted' : 'not redacted'}`}
              aria-pressed={on}
              onClick={() => onToggle(b.label)}
              className={`absolute ${on ? 'bg-amber-300/60 ring-1 ring-amber-600' : 'border border-dashed border-border'}`}
              style={{ left: pct(b.x, page.width), top: pct(b.y, page.height), width: pct(b.w, page.width), height: pct(b.h, page.height) }}
            />
          );
        })}
    </div>
  );
}

export function AnonymizePanel({ engine, ready, onError }) {
  const [file, setFile] = useState(null);
  const [doc, setDoc] = useState(null);
  const [pages, setPages] = useState([]); // [{ text, runs, width, height, llm: [{text,type}] }]
  const [progress, setProgress] = useState(null); // { done, total } while detecting
  const [terms, setTerms] = useState([]);
  const [term, setTerm] = useState('');
  const [disabled, setDisabled] = useState(new Set()); // labels the user un-redacted
  const [final, setFinal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const ctrlRef = useRef(null);

  useEffect(() => () => ctrlRef.current?.abort(), []);
  useEffect(() => () => doc?.loadingTask.destroy(), [doc]); // pdf.js v6: no doc.destroy()

  // Regex + LLM findings + typed terms, labeled across the whole document in reading order.
  // LLM findings from every page are searched on every page: the model often catches a name
  // on one page and misses it on another.
  const spans = useMemo(() => {
    const llm = pages.flatMap((p) => p.llm);
    return label(pages.flatMap((p, i) => detectPage(p.text, llm, terms).map((s) => ({ ...s, page: i }))));
  }, [pages, terms]);
  const boxesByPage = useMemo(() => pages.map((p, i) => boxesFor(p, spans.filter((s) => s.page === i))), [pages, spans]);
  const groups = useMemo(() => {
    const m = new Map();
    for (const s of spans) {
      const g = m.get(s.label) ?? { label: s.label, values: new Set(), count: 0, source: s.source };
      g.values.add(s.value.replace(/\s+/g, ' '));
      g.count++;
      m.set(s.label, g);
    }
    return [...m.values()];
  }, [spans]);
  const blankPages = pages.flatMap((p, i) => (p.text.trim() ? [] : [i + 1]));

  async function run() {
    if (!file) return;
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setPages([]);
    setTerms([]);
    setDisabled(new Set());
    setFinal(false);
    try {
      const pdf = await openPdf(file);
      setDoc(pdf);
      const out = [];
      for (let n = 1; n <= pdf.numPages; n++) out.push(await extractPage(pdf, n));
      if (out.every((p) => !p.text.trim())) throw new Error('No text layer (scanned PDF) — OCR not supported yet');
      setProgress({ done: 0, total: out.length });
      for (const [i, p] of out.entries()) {
        // Mock engine has no detect(): regex only.
        p.llm = engine.detect && p.text.trim() ? await engine.detect(p.text, { signal: ctrl.signal }) : [];
        setProgress({ done: i + 1, total: out.length });
      }
      setPages(out);
    } catch (err) {
      if (!ctrl.signal.aborted) onError(err);
    } finally {
      setProgress(null);
    }
  }

  function toggle(lbl) {
    setDisabled((d) => {
      const next = new Set(d);
      next.has(lbl) ? next.delete(lbl) : next.add(lbl);
      return next;
    });
  }

  function addTerm(e) {
    e.preventDefault();
    const t = term.trim();
    if (t && !terms.includes(t)) setTerms([...terms, t]);
    setTerm('');
  }

  async function download() {
    setExporting(true);
    try {
      const active = boxesByPage.map((boxes) => boxes.filter((b) => !disabled.has(b.label)));
      const url = URL.createObjectURL(await exportRedacted(doc, active));
      const a = Object.assign(document.createElement('a'), { href: url, download: file.name.replace(/\.pdf$/i, '') + '.redacted.pdf' });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      onError(err);
    } finally {
      setExporting(false);
    }
  }

  const busy = !!progress;

  return (
    <section className="rounded-xl border border-border bg-white p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept="application/pdf"
          aria-label="PDF to anonymize"
          disabled={busy}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setPages([]);
          }}
          className="flex-1 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-accent file:font-medium file:text-primary file:px-3 file:py-1.5"
        />
        {busy ? (
          <Button type="button" variant="ghost" onClick={() => ctrlRef.current?.abort()}>
            Cancel
          </Button>
        ) : (
          <Button onClick={run} disabled={!ready || !file}>
            Find PII
          </Button>
        )}
      </div>
      {!ready && <p className="text-xs text-muted-foreground">Download the model to enable</p>}
      {busy && (
        <p className="text-sm tabular-nums" aria-live="polite">
          Scanning page {Math.min(progress.done + 1, progress.total)} of {progress.total}…
        </p>
      )}

      {pages.length > 0 && (
        <>
          {blankPages.length > 0 && (
            <p role="alert" className="rounded-md bg-red-50 p-2 text-sm text-red-900">
              Page {blankPages.join(', ')} has no text layer (image only). It can't be checked for PII and will be exported as-is.
            </p>
          )}

          <div className="space-y-2">
            <h2 className="text-sm font-semibold">
              {groups.length} items found · {groups.filter((g) => !disabled.has(g.label)).length} redacted
            </h2>
            <ul className="max-h-60 overflow-auto space-y-1 text-sm">
              {groups.map((g) => (
                <li key={g.label} className="flex items-center gap-2">
                  <Checkbox
                    checked={!disabled.has(g.label)}
                    onCheckedChange={() => toggle(g.label)}
                    aria-label={`Redact ${g.label}`}
                   
                  />
                  <span className="font-mono text-xs">{g.label}</span>
                  <span className="truncate">{[...g.values].join(' / ')}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {g.count}× · {g.source}
                  </span>
                </li>
              ))}
            </ul>
            <form onSubmit={addTerm} className="flex gap-2">
              <Input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Missed something? Type it to redact every occurrence"
                aria-label="Term to redact"
                className="flex-1"
              />
              <Button type="submit" variant="ghost" disabled={!term.trim()}>
                Redact
              </Button>
            </form>
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setFinal((f) => !f)} className="flex-1">
              {final ? 'Back to review' : 'Preview redacted'}
            </Button>
            <Button onClick={download} disabled={exporting} className="flex-1">
              {exporting ? 'Building PDF…' : 'Download redacted PDF'}
            </Button>
          </div>

          <div className="space-y-3">
            {pages.map((p, i) => (
              <PageView key={i} doc={doc} n={i + 1} page={p} boxes={boxesByPage[i]} disabled={disabled} final={final} onToggle={toggle} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
