import { useState } from 'react';
import { PromptBox } from '@/components/PromptBox';
import { openPdf, extractPage } from '@/anonymize/pdf';

// "Ask about a document": upload a PDF, then ask questions answered from its text.
export function QaPanel({ engine, ready, onError }) {
  const [doc, setDoc] = useState(null); // { name, pages, blank: [page numbers] }
  const [reading, setReading] = useState(false);

  async function onFile(file) {
    setDoc(null);
    engine.setDocument?.([]);
    if (!file) return;
    setReading(true);
    let pdf;
    try {
      pdf = await openPdf(file);
      const pages = [];
      for (let n = 1; n <= pdf.numPages; n++) pages.push(await extractPage(pdf, n));
      if (pages.every((p) => !p.text.trim())) throw new Error('No text layer (scanned PDF) — OCR not supported yet');
      engine.setDocument?.(pages);
      setDoc({ name: file.name, pages: pages.length, blank: pages.flatMap((p, i) => (p.text.trim() ? [] : [i + 1])) });
    } catch (err) {
      onError(err);
    } finally {
      pdf?.destroy();
      setReading(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2">
        <input
          type="file"
          accept="application/pdf"
          aria-label="PDF to ask about"
          disabled={reading}
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 dark:file:bg-slate-800 dark:file:text-slate-100"
        />
        <p className="text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
          {reading ? 'Reading PDF…' : doc ? `${doc.name} · ${doc.pages} page${doc.pages === 1 ? '' : 's'}` : 'Upload a PDF, then ask in English or Spanish'}
        </p>
        {doc?.blank.length > 0 && (
          <p role="alert" className="rounded-md bg-red-50 dark:bg-red-950/50 p-2 text-sm text-red-900 dark:text-red-200">
            Page {doc.blank.join(', ')} has no text layer (image only); answers can't use it.
          </p>
        )}
      </section>
      <PromptBox engine={engine} ready={ready && !!doc} onError={onError} />
    </div>
  );
}
