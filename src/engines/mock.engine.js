// Fake engine for UI testing: ~60 MB "download" over ~8 s, then a short
// init phase, then a canned reply streamed word by word.

export const MOCK_MODEL = { label: 'Mock engine', modelId: 'mock/simulated-60mb', approxMB: 60 };

const FILES = [
  { name: 'config.json', bytes: 1_800 },
  { name: 'tokenizer_config.json', bytes: 4_200 },
  { name: 'tokenizer.json', bytes: 2_100_000 },
  { name: 'onnx/model_q4f16.onnx', bytes: 57_900_000 },
];
const TOTAL = FILES.reduce((sum, f) => sum + f.bytes, 0);
const TICK_MS = 100;
const BYTES_PER_TICK = TOTAL / 80; // 80 ticks × 100 ms ≈ 8 s

const REPLY =
  'This is a simulated reply from the mock engine. No model ran: tokens are ' +
  'streamed on a timer so you can check streaming, the token counter, the ' +
  'elapsed clock, and the Cancel button.';

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const abortError = () => signal.reason ?? new DOMException('Aborted', 'AbortError');
    if (signal?.aborted) return reject(abortError());
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function createMockEngine() {
  let loaded = false;

  return {
    modelId: MOCK_MODEL.modelId,

    async load({ onProgress, signal }) {
      let done = 0;
      for (const file of FILES) {
        let fileDone = 0;
        while (fileDone < file.bytes) {
          await sleep(TICK_MS, signal);
          const chunk = Math.min(BYTES_PER_TICK, file.bytes - fileDone);
          fileDone += chunk;
          done += chunk;
          onProgress?.({
            loadedBytes: done,
            totalBytes: TOTAL,
            phase: 'downloading',
            file: file.name,
            raw: { mock: true, status: 'progress', file: file.name, loaded: fileDone, total: file.bytes },
          });
        }
      }
      for (const step of ['compiling shaders', 'warming up']) {
        onProgress?.({
          loadedBytes: done,
          totalBytes: TOTAL,
          phase: 'initializing',
          raw: { mock: true, status: step },
        });
        await sleep(800, signal);
      }
      loaded = true;
    },

    async generate(prompt, { onToken, signal }) {
      if (!loaded) throw new Error('Mock model not loaded');
      const text = `You said: "${prompt}". ${REPLY}`;
      for (const token of text.match(/\S+\s*/g)) {
        await sleep(50, signal);
        onToken?.(token);
      }
      return text;
    },

    dispose() {
      loaded = false;
    },
  };
}
