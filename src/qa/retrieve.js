// Pure: pick the document excerpts that fit Qwen's 4,096-token context for one question.
import { pack } from '../translation/text.js';

// ~2.2k tokens of document at ~3.4 chars/token, leaving room for the prompt and a 768-token answer.
// ponytail: char estimate, no tokenizer; lower it if WebLLM reports context overflow.
export const BUDGET = 7500;

// Common short EN/ES words that would match every chunk.
const STOP = new Set('the and for are was you your with that this from what when how can que los las del con por una mis sus para como cuando cual donde puedo tengo'.split(' '));

export const words = (text) =>
  new Set(
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 2 && !STOP.has(w))
  );

// pages: [{ text }] -> [{ page (1-based), text }], each chunk <= ~1,500 chars.
export function chunks(pages) {
  return pages.flatMap((p, i) => pack(p.text.split('\n'), '\n').filter((t) => t.trim()).map((text) => ({ page: i + 1, text })));
}

// Whole document if it fits; else the chunks sharing the most words with any query, in page order.
export function pick(all, queries, budget = BUDGET) {
  if (all.reduce((n, c) => n + c.text.length, 0) <= budget) return all;
  const q = new Set(queries.flatMap((s) => [...words(s)]));
  const scored = all.map((c, i) => {
    const w = words(c.text);
    return { c, i, score: [...q].filter((x) => w.has(x)).length };
  });
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  const out = [];
  let used = 0;
  for (const s of scored) {
    if (used + s.c.text.length > budget) continue;
    out.push(s);
    used += s.c.text.length;
  }
  return out.sort((a, b) => a.i - b.i).map((s) => s.c);
}
