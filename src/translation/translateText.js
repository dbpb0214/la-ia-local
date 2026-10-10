// Orchestrator: normalize -> sentences -> glossary protect -> engine -> verify/fallback -> rejoin.
import { segment, rejoin } from './text.js';
import { protect, restore, applyTerms } from './glossary.js';

async function translateSentence(sentence, { src, tgt, engine, glossary, log }) {
  const pair = { src, tgt };
  const { text, map } = protect(sentence, glossary);
  if (!map.length) return engine.translate(sentence, pair);

  const withTokens = await engine.translate(text, pair);
  const restored = restore(withTokens, map);
  if (restored.ok) return restored.text;

  // Placeholder mangled: retry without placeholders, then find/replace.
  const raw = await engine.translate(sentence, pair);
  const fixed = applyTerms(raw, [...new Set(map.map((m) => m.term))]);
  log.push({
    engine: engine.id,
    sentence,
    reason: 'placeholder mangled',
    placeholderOutput: withTokens,
    applied: fixed.applied,
    unenforced: fixed.unenforced,
  });
  return fixed.text;
}

export async function translateText(text, { src, tgt, engine, glossary = [], onProgress, signal }) {
  const paragraphs = segment(text, src);
  const total = paragraphs.flat(2).length;
  const log = [];
  const timings = [];
  let done = 0;

  const out = [];
  for (const para of paragraphs) {
    const lines = [];
    for (const line of para) {
      const sentences = [];
      for (const sentence of line) {
        signal?.throwIfAborted();
        const t0 = performance.now();
        sentences.push(await translateSentence(sentence, { src, tgt, engine, glossary, log }));
        timings.push({ sentence, ms: performance.now() - t0 });
        onProgress?.({ done: ++done, total, sentence });
      }
      lines.push(sentences);
    }
    out.push(lines);
  }
  return { text: rejoin(out), log, timings };
}
