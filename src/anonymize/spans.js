// Span utilities. A span is { start, end, value, type, source: 'regex'|'llm'|'manual' }
// with character offsets into one page's text.

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();

// Every occurrence of `needle` in `text`, ignoring case and whitespace differences
// (LLM output and PDF text rarely agree on spacing). Not found => [] (hallucination).
export function findAll(text, needle, extra = {}) {
  const words = String(needle ?? '').trim().split(/\s+/).filter(Boolean).map(escape);
  if (!words.length || words.join('').length < 2) return [];
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${words.join('\\s+')}(?![\\p{L}\\p{N}])`, 'giu');
  return [...text.matchAll(re)].map((m) => ({ start: m.index, end: m.index + m[0].length, value: m[0], ...extra }));
}

// Union overlapping spans (leak-safe: covers both). Regex type wins over LLM guesses.
export function merge(spans, text) {
  const out = [];
  for (const s of [...spans].sort((a, b) => a.start - b.start || b.end - a.end)) {
    const last = out.at(-1);
    if (last && s.start < last.end) {
      if (s.end > last.end) last.end = s.end;
      if (s.source === 'regex' && last.source !== 'regex') Object.assign(last, { type: s.type, source: 'regex' });
    } else out.push({ ...s });
  }
  return out.map((s) => ({ ...s, value: text.slice(s.start, s.end) }));
}

// Number labels across the whole document: same type + same value => same label.
// `spans` must be in reading order.
export function label(spans) {
  const counts = {};
  const labels = new Map();
  return spans.map((s) => {
    const key = `${s.type}:${norm(s.value)}`;
    if (!labels.has(key)) labels.set(key, `[${s.type}_${(counts[s.type] = (counts[s.type] ?? 0) + 1)}]`);
    return { ...s, label: labels.get(key) };
  });
}
