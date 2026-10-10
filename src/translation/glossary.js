// Glossary: IndexedDB store (seeded from glossary.seed.json) + placeholder protection.
import seed from './glossary.seed.json';

const DB_NAME = 'glossary';
const STORE = 'terms'; // { id, src, tgt, srcLang, tgtLang }

const req = (r) => new Promise((resolve, reject) => {
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
});

function openDb() {
  const r = indexedDB.open(DB_NAME, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
  return req(r);
}

export async function loadGlossary({ src, tgt }) {
  const db = await openDb();
  try {
    let terms = await req(db.transaction(STORE).objectStore(STORE).getAll());
    if (!terms.length) {
      const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
      await Promise.all(seed.map((t) => req(store.add(t))));
      terms = await req(db.transaction(STORE).objectStore(STORE).getAll());
    }
    return terms.filter((t) => t.srcLang === src && t.tgtLang === tgt);
  } finally {
    db.close();
  }
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const termRe = (term) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(term)}(?![\\p{L}\\p{N}])`, 'giu');

// Replace source terms (longest first) with GLS0, GLS1, … tokens.
export function protect(sentence, terms) {
  const map = [];
  let text = sentence;
  for (const term of [...terms].sort((a, b) => b.src.length - a.src.length)) {
    text = text.replace(termRe(term.src), () => {
      const token = `GLS${map.length}`;
      map.push({ token, term });
      return token;
    });
  }
  return { text, map };
}

// Swap tokens for target terms; ok=false if any token is missing or duplicated.
export function restore(output, map) {
  let text = output;
  let ok = true;
  for (const { token, term } of map) {
    const re = new RegExp(`\\b${token}\\b`, 'g');
    if ((text.match(re) ?? []).length !== 1) ok = false;
    text = text.replace(re, term.tgt);
  }
  return { text, ok };
}

// Fallback for a sentence translated without placeholders: replace any source terms the
// engine left untranslated. Terms it translated differently can't be found and are reported.
export function applyTerms(output, terms) {
  let text = output;
  const applied = [];
  const unenforced = [];
  for (const term of terms) {
    if (termRe(term.src).test(text)) {
      text = text.replace(termRe(term.src), term.tgt);
      applied.push(term.src);
    } else if (!termRe(term.tgt).test(text)) {
      unenforced.push(term.src);
    }
  }
  return { text, applied, unenforced };
}
