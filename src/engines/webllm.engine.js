// WebLLM adapter (step 5): import @mlc-ai/web-llm here and map its init
// progress reports into the onProgress contract in ./index.js.
export function createWebLLMEngine({ modelId } = {}) {
  return {
    modelId,
    async load() {
      throw new Error('not implemented yet');
    },
    async generate() {
      throw new Error('not implemented yet');
    },
    dispose() {},
  };
}
