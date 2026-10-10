// Pre-processing for extracted document text (PDF/DOCX/OCR), shared by all engines.
// Structure: text -> paragraphs (blank-line separated) -> lines -> sentences.

const ENDS_SENTENCE = /[.!?:;"”')\]]$/;
// Opus-MT caps at 512 tokens; ~1,500 chars ≈ 400 tokens at ~4 chars/token (estimate, no tokenizer).
const MAX_CHARS = 1500;

// Join lines broken mid-sentence, drop end-of-line hyphenation, keep paragraph breaks.
export function normalize(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n/)
    .map((para) =>
      para
        .replace(/(\p{L})-\n[ \t]*(\p{Ll})/gu, '$1$2')
        .split('\n')
        .map((line) => line.trim().replace(/\s+/g, ' '))
        .filter(Boolean)
        .reduce((acc, line) => (!acc ? line : ENDS_SENTENCE.test(acc) ? `${acc}\n${line}` : `${acc} ${line}`), '')
    )
    .filter(Boolean)
    .join('\n\n');
}

// Greedily pack pieces into chunks of at most MAX_CHARS.
function pack(pieces, sep) {
  const out = [];
  for (const piece of pieces) {
    const last = out.length - 1;
    if (last >= 0 && out[last].length + sep.length + piece.length <= MAX_CHARS) out[last] += sep + piece;
    else out.push(piece);
  }
  return out;
}

function splitLong(sentence) {
  if (sentence.length <= MAX_CHARS) return [sentence];
  return pack(sentence.split(/(?<=[;,])\s+/), ' ').flatMap((chunk) =>
    chunk.length <= MAX_CHARS ? [chunk] : pack(chunk.split(/\s+/), ' ')
  );
}

// Intl.Segmenter breaks after abbreviations like "Dr." — re-merge those.
// ponytail: short EN/ES list; extend when the harness shows a bad split.
const ABBREV = /(?:^|\s)(?:Dr|Dra|Mr|Mrs|Ms|Prof|Sr|Sra|Srta|Jr|St|No|vs|[Aa]pprox|Aprox|Ud|Uds|e\.g|i\.e|U\.S|\p{Lu})\.$/u;

function mergeAbbreviations(sentences) {
  return sentences.reduce((out, s) => {
    if (out.length && ABBREV.test(out[out.length - 1])) out[out.length - 1] += ` ${s}`;
    else out.push(s);
    return out;
  }, []);
}

export function segment(text, lang) {
  const segmenter = new Intl.Segmenter(lang, { granularity: 'sentence' });
  return normalize(text)
    .split('\n\n')
    .map((para) =>
      para.split('\n').map((line) =>
        mergeAbbreviations([...segmenter.segment(line)].map((s) => s.segment.trim()).filter(Boolean)).flatMap(splitLong)
      )
    );
}

export function rejoin(paragraphs) {
  return paragraphs.map((para) => para.map((line) => line.join(' ')).join('\n')).join('\n\n');
}
