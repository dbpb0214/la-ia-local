// Main-page adapter: plugs the translation module (src/translation) into the page's
// load/generate engine contract. Picks Chrome Translator, else Opus-MT (transformers.js).
import { pickEngine, translateText, loadGlossary } from '@/translation';

const PAIRS = [
  { src: 'en', tgt: 'es' },
  { src: 'es', tgt: 'en' },
];

export function createTranslationEngine({ modelId } = {}) {
  let engine = null;
  let pair = PAIRS[0];

  return {
    modelId,

    setDirection(dir) {
      pair = PAIRS.find((p) => `${p.src}>${p.tgt}` === dir) ?? PAIRS[0];
    },

    // Called from the Download click; both directions start together so Chrome's
    // user-activation window covers both language packs.
    async load({ onProgress, signal }) {
      engine = await pickEngine(pair);
      if (!engine) throw new Error('No translation engine available (offline and no model cached?)');
      const info = { backend: engine.label };
      onProgress({ phase: 'downloading', raw: { picked: engine.id }, info });

      const parts = new Map(); // direction -> { percent, loaded, total }
      const report = () => {
        const all = [...parts.values()];
        const bytes = all.length === PAIRS.length && all.every((p) => p.total);
        onProgress({
          phase: 'downloading',
          loadedBytes: bytes ? all.reduce((a, p) => a + p.loaded, 0) : undefined,
          totalBytes: bytes ? all.reduce((a, p) => a + p.total, 0) : undefined,
          percent: all.reduce((a, p) => a + (p.percent ?? 0), 0) / PAIRS.length,
          raw: { status: 'progress', directions: Object.fromEntries(parts) }, // byte update (sampled in the log)
        });
      };

      await Promise.all(
        PAIRS.map((p) =>
          engine.init(p, (e) => {
            parts.set(`${p.src}>${p.tgt}`, { percent: e.percent, loaded: e.loadedBytes, total: e.totalBytes });
            report();
          })
        )
      );
      signal?.throwIfAborted();
      onProgress({ phase: 'ready', raw: { ready: engine.id }, info });
    },

    async generate(prompt, { onToken, signal }) {
      if (!engine) throw new Error('Translation engine not loaded');
      const glossary = await loadGlossary(pair);
      const { text, log } = await translateText(prompt, { ...pair, engine, glossary, signal });
      if (log.length) console.info('[translation] glossary fallbacks', log);
      onToken?.(text);
      return text;
    },

    dispose() {
      engine = null;
    },
  };
}
