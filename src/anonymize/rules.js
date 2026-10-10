// Deterministic PII rules for US immigration documents. Each rule's `group` (if set)
// is the capture group to redact instead of the whole match (keeps the "A-Number:" label).

const DIGITS_9 = String.raw`\d{3}[-\s]?\d{3}[-\s]?\d{2,3}`; // 8 or 9 digits, optionally grouped

const RULES = [
  { type: 'A_NUMBER', re: new RegExp(String.raw`\bA[-\s]?${DIGITS_9}\b`, 'g') },
  {
    type: 'A_NUMBER',
    group: 1,
    re: new RegExp(String.raw`(?:A-?Number|A#|Alien (?:Registration )?Number|N[uú]mero A)\s*[:#]?\s*(${DIGITS_9})\b`, 'gid'),
  },
  { type: 'SSN', re: /\b\d{3}-\d{2}-\d{4}\b/g }, // retyped ITIN below when it starts with 9
  { type: 'RECEIPT', re: /\b(?:EAC|WAC|LIN|SRC|NBC|MSC|IOE|YSC|TSC|VSC|NSC|CSC)[-\s]?\d{10}\b/gi },
  { type: 'EMAIL', re: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g },
  { type: 'PHONE', re: /(?:\+?1[-.\s]?)?(?:\(\d{3}\)|\b\d{3})[-.\s]?\d{3}[-.\s]\d{4}\b/g },
];

export function ruleSpans(text) {
  const spans = [];
  for (const { type, re, group } of RULES) {
    for (const m of text.matchAll(re)) {
      const [start, end] = group ? m.indices[group] : [m.index, m.index + m[0].length];
      const value = text.slice(start, end);
      spans.push({ start, end, value, source: 'regex', type: type === 'SSN' && value.startsWith('9') ? 'ITIN' : type });
    }
  }
  return spans;
}
