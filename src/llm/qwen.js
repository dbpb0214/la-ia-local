// The one shared WebLLM engine (Qwen3-1.7B), used by Anonymize and Q&A. A module singleton so
// both runtimes reuse one download and one copy in GPU memory.
// Qwen via transformers.js on this stack produced NaN output (q4f16) or failed to allocate
// (q4, Qwen3); WebLLM loads sharded weights and can constrain output to JSON.
// ponytail: a loaded model stays in GPU memory (~2 GB) after switching to Translation; add an
// explicit unload if that matters.

export const MODEL = 'Qwen3-1.7B-q4f16_1-MLC';
export const QWEN_INFO = { backend: 'webgpu (WebLLM)', dtype: 'q4f16_1' };

let worker = null;
let engine = null;
let loading = null; // Promise<engine> while downloading
const listeners = new Set(); // onProgress of every caller waiting on `loading`

function kill() {
  worker?.terminate(); // frees the GPU memory too
  worker = null;
  engine = null;
  loading = null;
}

export function qwen() {
  if (!engine) throw new Error('Model not loaded');
  return engine;
}

// Idempotent: resolves at once when loaded; joins an in-flight load otherwise.
export async function loadQwen({ onProgress, signal } = {}) {
  signal?.throwIfAborted();
  if (engine) return engine;
  loading ??= (async () => {
    // Dynamic: web-llm is ~2 MB gz; keep it off the page-load bundle.
    const { CreateWebWorkerMLCEngine } = await import('@mlc-ai/web-llm');
    worker = new Worker(new URL('./qwen.worker.js', import.meta.url), { type: 'module' });
    engine = await CreateWebWorkerMLCEngine(worker, MODEL, {
      // status 'progress' marks these as sampled byte-style updates in loadMachine.
      initProgressCallback: (r) => {
        const p = { percent: r.progress * 100, phase: r.progress >= 1 ? 'initializing' : 'downloading', raw: { status: 'progress', ...r } };
        for (const l of listeners) l(p);
      },
    });
    return engine;
  })();
  loading.catch(kill); // allow retry after a failed load

  // WebLLM can't cancel a download: kill the worker, start fresh next time. The listener is
  // removed once settled, so a later abort (e.g. runtime switch) can't kill a loaded model.
  let onAbort;
  const aborted = new Promise((_, reject) => {
    onAbort = () => (kill(), reject(new DOMException('Aborted', 'AbortError')));
    signal?.addEventListener('abort', onAbort, { once: true });
  });
  if (onProgress) listeners.add(onProgress);
  try {
    return await Promise.race([loading, aborted]);
  } finally {
    listeners.delete(onProgress);
    signal?.removeEventListener('abort', onAbort);
  }
}
