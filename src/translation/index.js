import { chromeEngine } from './chrome.engine.js';
import { opusEngine, gemmaEngine } from './worker.engine.js';

/*
 * TranslationEngine contract:
 *   id, label, experimental?
 *   status({src,tgt}) -> { state: 'ready'|'available'|'needs-download'|'unavailable', detail }
 *   isAvailable({src,tgt}) -> boolean   (state !== 'unavailable')
 *   init({src,tgt}, onProgress)         onProgress({ percent?, loadedBytes?, totalBytes?, file?, raw })
 *   translate(text, {src,tgt}) -> string
 * Languages are BCP 47 short codes ('en', 'es'). Never a chat LLM.
 */
export const ENGINES = [chromeEngine, opusEngine, gemmaEngine]; // priority order

export async function pickEngine(pair, { force, allowExperimental = false } = {}) {
  if (force) {
    const engine = ENGINES.find((e) => e.id === force);
    if (!engine) throw new Error(`Unknown translation engine: ${force}`);
    return engine;
  }
  for (const engine of ENGINES) {
    if (engine.experimental && !allowExperimental) continue;
    if (await engine.isAvailable(pair)) return engine;
  }
  return null;
}

export { translateText } from './translateText.js';
export { loadGlossary } from './glossary.js';
export { disposeWorker } from './worker.engine.js';
