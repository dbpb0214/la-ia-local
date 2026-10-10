// Main-thread proxies for engines that run in ./translate.worker.js (Opus-MT, TranslateGemma).
// One shared worker; requests are matched to replies by id.

const CACHE_NAME = 'transformers-cache'; // transformers.js default env.cacheKey
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

let worker = null;
let nextId = 0;
const pending = new Map(); // id -> { resolve, reject, onProgress }

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./translate.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    const p = pending.get(data.id);
    if (!p) return;
    if (data.status === 'progress') return p.onProgress?.(data.raw);
    pending.delete(data.id);
    if (data.status === 'done') p.resolve(data.result);
    else p.reject(new Error(data.message));
  };
  worker.onerror = (e) => disposeWorker(new Error(`Translation worker crashed: ${e.message ?? 'unknown'}`));
  return worker;
}

function call(msg, onProgress) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject, onProgress });
    getWorker().postMessage({ ...msg, id });
  });
}

// Drops all loaded models (used by "Clear model cache").
export function disposeWorker(reason = new Error('Translation worker disposed')) {
  worker?.terminate();
  worker = null;
  for (const p of pending.values()) p.reject(reason);
  pending.clear();
}

async function hasCachedOnnx(repo) {
  try {
    const keys = await (await caches.open(CACHE_NAME)).keys();
    return keys.some((r) => r.url.includes(`/${repo}/`) && r.url.includes('/onnx/'));
  } catch {
    return false;
  }
}

// Map transformers.js progress events to { percent, loadedBytes, totalBytes, raw }.
function byteProgress(onProgress) {
  return (raw) => {
    // Only aggregate byte events carry a usable total; others (initiate/done/ready) are skipped.
    if (raw?.status !== 'progress_total' || !isNum(raw.total) || raw.total <= 0) return;
    onProgress?.({ percent: (raw.loaded / raw.total) * 100, loadedBytes: raw.loaded, totalBytes: raw.total, raw });
  };
}

function workerEngine({ id, label, experimental = false, repoFor, sizeNote, requiresWebGPU = false }) {
  const ready = new Set(); // pair keys initialized in the current worker
  const pairKey = ({ src, tgt }) => `${src}>${tgt}`;

  return {
    id,
    label,
    experimental,

    async status(pair) {
      const repo = repoFor(pair);
      if (!repo) return { state: 'unavailable', detail: `no model for ${pairKey(pair)}` };
      if (requiresWebGPU && !(await navigator.gpu?.requestAdapter().catch(() => null))) {
        return { state: 'unavailable', detail: 'WebGPU adapter required' };
      }
      if (worker && ready.has(pairKey(pair))) return { state: 'ready', detail: repo };
      if (await hasCachedOnnx(repo)) return { state: 'available', detail: `${repo} (cached)` };
      if (navigator.onLine) return { state: 'needs-download', detail: `${repo} (${sizeNote})` };
      return { state: 'unavailable', detail: `offline and ${repo} not cached` };
    },

    async isAvailable(pair) {
      return (await this.status(pair)).state !== 'unavailable';
    },

    async init(pair, onProgress) {
      await call({ type: 'init', engine: id, pair }, byteProgress(onProgress));
      ready.add(pairKey(pair));
    },

    translate(text, pair) {
      return call({ type: 'translate', engine: id, pair, text });
    },
  };
}

const OPUS = { 'en>es': 'Xenova/opus-mt-en-es', 'es>en': 'Xenova/opus-mt-es-en' };

export const opusEngine = workerEngine({
  id: 'opusmt',
  label: 'Opus-MT (transformers.js, WASM q8)',
  repoFor: ({ src, tgt }) => OPUS[`${src}>${tgt}`],
  sizeNote: '~113 MB',
});

export const gemmaEngine = workerEngine({
  id: 'translategemma',
  label: 'TranslateGemma 4B (experimental, WebGPU q4)',
  experimental: true,
  requiresWebGPU: true,
  repoFor: ({ src, tgt }) =>
    ['en', 'es'].includes(src) && ['en', 'es'].includes(tgt) && src !== tgt
      ? 'onnx-community/translategemma-text-4b-it-ONNX'
      : null,
  sizeNote: '~3.1 GB',
});
