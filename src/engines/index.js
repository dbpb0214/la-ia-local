import { createTranslationEngine } from './translation.engine.js';
import { createQaEngine } from '@/qa/qa.engine.js';
import { createMockEngine } from './mock.engine.js';
import { createAnonymizeEngine } from '@/anonymize/anonymize.engine.js';

export const MODELS = {
  translation: {
    label: 'Translation',
    modelId: 'Chrome Translator, else Xenova/opus-mt-en-es + Xenova/opus-mt-es-en',
    approxMB: 239, // Opus-MT, both directions (measured 119.4 MB each); Chrome packs are managed by Chrome
  },
  anonymize: {
    label: 'Anonymize PDF',
    modelId: 'Qwen3-1.7B-q4f16_1-MLC (WebLLM)',
    approxMB: 984, // mlc-ai/Qwen3-1.7B-q4f16_1-MLC, 39 files; ~2 GB VRAM at runtime
  },
  qa: {
    label: 'Ask about a document',
    modelId: 'Qwen3-1.7B-q4f16_1-MLC (WebLLM, shared with Anonymize)',
    approxMB: 985, // same download as Anonymize; Opus es->en (119 MB) only if Chrome Translator is missing
  },
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
  anonymize: createAnonymizeEngine,
  qa: createQaEngine,
};

export function getEngine(runtimeId, { mock = false } = {}) {
  if (mock) return createMockEngine();
  const factory = FACTORIES[runtimeId];
  if (!factory) throw new Error(`Unknown runtime: ${runtimeId}`);
  return factory(MODELS[runtimeId]);
}
