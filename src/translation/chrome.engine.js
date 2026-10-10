// Chrome built-in Translator API (Chrome 138+ desktop). Main thread only: the API is not
// exposed in Web Workers. Docs: developer.chrome.com/docs/ai/translator-api
const translators = new Map(); // 'en>es' -> Translator
const key = ({ src, tgt }) => `${src}>${tgt}`;

export const chromeEngine = {
  id: 'chrome',
  label: 'Chrome Translator (built-in)',

  // Chrome reports 'downloadable' for every pair until this site creates one (privacy),
  // so 'needs-download' may really mean "already on disk, needs one click".
  async status({ src, tgt }) {
    if (translators.has(key({ src, tgt }))) return { state: 'ready', detail: 'translator created' };
    if (!('Translator' in self)) {
      return { state: 'unavailable', detail: 'Translator API missing (Chrome 138+ desktop, top-level or same-origin frame)' };
    }
    try {
      const a = await self.Translator.availability({ sourceLanguage: src, targetLanguage: tgt });
      if (a === 'unavailable') return { state: 'unavailable', detail: `pair ${src}→${tgt} unavailable` };
      return { state: a === 'available' ? 'available' : 'needs-download', detail: `availability: ${a}` };
    } catch (e) {
      return { state: 'unavailable', detail: `availability() threw: ${e?.message ?? e}` };
    }
  },

  async isAvailable(pair) {
    return (await this.status(pair)).state !== 'unavailable';
  },

  // Must be called from a user gesture (click) when the language pack isn't downloaded yet.
  async init(pair, onProgress) {
    if (translators.has(key(pair))) return;
    const translator = await self.Translator.create({
      sourceLanguage: pair.src,
      targetLanguage: pair.tgt,
      monitor(m) {
        m.addEventListener('downloadprogress', (e) =>
          onProgress?.({ percent: e.loaded * 100, raw: { type: e.type, loaded: e.loaded, total: e.total } })
        );
      },
    });
    translators.set(key(pair), translator);
  },

  // Sentences are capped at ~1,500 chars by text.js, so plain translate() is used;
  // translateStreaming() isn't needed at that size.
  async translate(text, pair) {
    const translator = translators.get(key(pair));
    if (!translator) throw new Error(`Chrome translator ${key(pair)} not initialized`);
    return translator.translate(text);
  },
};
