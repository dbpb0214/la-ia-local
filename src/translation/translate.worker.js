// Runs Opus-MT and TranslateGemma off the main thread.
//   main -> worker: { id, type: 'init' | 'translate', engine, pair: {src,tgt}, text? }
//   worker -> main: { id, status: 'progress', raw } | { id, status: 'done', result } | { id, status: 'error', message }
import { env, pipeline } from '@huggingface/transformers';
import ortWasm from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url';
import ortMjs from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url';

// Self-host the ONNX Runtime files (instead of jsDelivr) so the app works offline.
env.backends.onnx.wasm.wasmPaths = { wasm: ortWasm, mjs: ortMjs };

const OPUS = { 'en>es': 'Xenova/opus-mt-en-es', 'es>en': 'Xenova/opus-mt-es-en' };
const GEMMA = 'onnx-community/translategemma-text-4b-it-ONNX';

const pipes = new Map(); // key -> Promise<pipeline>

function getPipe(engine, { src, tgt }, progress_callback) {
  // TranslateGemma takes the language pair per call, so one pipeline serves both directions.
  const key = engine === 'translategemma' ? engine : `${engine}:${src}>${tgt}`;
  if (!pipes.has(key)) {
    const created =
      engine === 'opusmt'
        ? pipeline('translation', OPUS[`${src}>${tgt}`], { device: 'wasm', dtype: 'q8', progress_callback })
        : engine === 'translategemma'
          ? // Settings from the HF Space webml-community/TranslateGemma-WebGPU (src/ai/Translator.ts).
            pipeline('text-generation', GEMMA, { device: 'webgpu', dtype: 'q4', progress_callback })
          : Promise.reject(new Error(`Unknown engine: ${engine}`));
    pipes.set(key, created);
    created.catch(() => pipes.delete(key)); // allow retry after a failed load
  }
  return pipes.get(key);
}

async function translate(engine, pipe, text, { src, tgt }) {
  if (engine === 'opusmt') {
    const [out] = await pipe(text);
    return out.translation_text;
  }
  const messages = [
    { role: 'user', content: [{ type: 'text', source_lang_code: src, target_lang_code: tgt, text }] },
  ];
  const output = await pipe(messages, { max_new_tokens: 1024 });
  return output[0].generated_text.pop().content;
}

self.onmessage = async ({ data }) => {
  const { id, type, engine, pair } = data;
  try {
    const pipe = await getPipe(engine, pair, (raw) => self.postMessage({ id, status: 'progress', raw }));
    const result = type === 'translate' ? await translate(engine, pipe, data.text, pair) : null;
    self.postMessage({ id, status: 'done', result });
  } catch (e) {
    self.postMessage({ id, status: 'error', message: e?.message ?? String(e) });
  }
};
