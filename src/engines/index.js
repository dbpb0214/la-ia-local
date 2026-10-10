import { createTranslationEngine } from './translation.engine.js';
import { createWebLLMEngine } from './webllm.engine.js';
import { createMockEngine } from './mock.engine.js';

export const MODELS = {
  translation: {
    label: 'Translation',
    modelId: 'Chrome Translator, else Xenova/opus-mt-en-es + Xenova/opus-mt-es-en',
    approxMB: 239, // Opus-MT, both directions (measured 119.4 MB each); Chrome packs are managed by Chrome
  },
  webllm: { label: 'WebLLM', modelId: 'TODO_SET_IN_STEP_5', approxMB: null },
};

/*
 * Engine contract (ours, not any library's). Each engine adapter maps its
 * library's native events into this shape:
 *
 *   load({ onProgress, signal }) -> Promise<void>   resolves when ready to generate
 *     onProgress({
 *       loadedBytes,  // number | undefined — aggregate bytes downloaded so far
 *       totalBytes,   // number | undefined — aggregate total; undefined => indeterminate
 *       phase,        // 'downloading' | 'initializing' | any other short string
 *       file,         // string | undefined — current file name
 *       raw,          // the library's original event payload, untouched (for the log)
 *       percent,      // optional — used when bytes are unknown (e.g. Chrome language packs)
 *       info,         // optional — { backend, dtype, shaderF16, crossOriginIsolated, fromCache }
 *     })
 *   generate(prompt, { onToken, signal }) -> Promise<string>   onToken(textChunk)
 *   dispose()
 *
 * Aborting `signal` must reject the pending promise. load() rejections may carry
 * err.code (e.g. 'WEBGPU_REQUIRED') and err.phase.
 */
const FACTORIES = {
  translation: createTranslationEngine,
  webllm: createWebLLMEngine,
};

export function getEngine(runtimeId, { mock = false } = {}) {
  if (mock) return createMockEngine();
  const factory = FACTORIES[runtimeId];
  if (!factory) throw new Error(`Unknown runtime: ${runtimeId}`);
  return factory(MODELS[runtimeId]);
}
