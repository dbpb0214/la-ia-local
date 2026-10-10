// Page adapter for "Ask about a document": fits the engine contract in src/engines/index.js.
// Answers from the uploaded PDF with the shared Qwen3-1.7B (src/llm/qwen.js). Spanish questions
// are translated to English only to search the (mostly English) document; Qwen sees the original.
import { loadQwen, qwen, MODEL, QWEN_INFO } from '@/llm/qwen.js';
import { pickEngine, translateText } from '@/translation';
import { chunks, pick } from './retrieve.js';

const SEARCH_PAIR = { src: 'es', tgt: 'en' };

const SYSTEM = `You answer questions about one document using only the excerpts given.
- If the excerpts do not contain the answer, say you could not find it in the document. Do not guess.
- Answer in the same language as the question (English or Spanish).
- Be brief. Cite the page for each fact, like (p. 2).`;

export function createQaEngine({ modelId } = {}) {
  let doc = []; // [{ page, text }]
  let translator = null;

  return {
    modelId,

    setDocument(pages) {
      doc = chunks(pages);
    },

    async load({ onProgress, signal }) {
      // Translator first: Chrome's Translator.create() needs the Download click's user activation.
      // ponytail: Opus fallback download progress isn't shown, only Qwen's; merge if it matters.
      const search = pickEngine(SEARCH_PAIR)
        .then(async (t) => (t && (await t.init(SEARCH_PAIR, () => {}), t)))
        .catch((e) => console.warn('[qa] question translation unavailable; searching with the original only', e));
      const [t] = await Promise.all([search, loadQwen({ onProgress, signal })]);
      translator = t ?? null;
      onProgress({ phase: 'ready', raw: { ready: MODEL, searchTranslator: translator?.id ?? null }, info: QWEN_INFO });
    },

    async generate(question, { onToken, signal }) {
      if (!doc.length) throw new Error('Upload a PDF first');
      const engine = qwen();
      const queries = [question];
      if (translator) {
        try {
          queries.push((await translateText(question, { ...SEARCH_PAIR, engine: translator, glossary: [], signal })).text);
        } catch (e) {
          console.warn('[qa] question translation failed; searching with the original only', e);
        }
      }
      const excerpts = pick(doc, queries);
      console.info('[qa] queries', queries, 'excerpt pages', excerpts.map((c) => c.page));

      const stop = () => engine.interruptGenerate();
      signal?.addEventListener('abort', stop);
      try {
        const stream = await engine.chat.completions.create({
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: `Document excerpts:\n\n${excerpts.map((c) => `[p. ${c.page}]\n${c.text}`).join('\n\n')}\n\nQuestion: ${question}` },
          ],
          stream: true,
          temperature: 0,
          max_tokens: 768,
          extra_body: { enable_thinking: false }, // Qwen3: no <think> block
        });
        let text = '';
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            text += delta;
            onToken?.(delta);
          }
        }
        signal?.throwIfAborted();
        return text;
      } finally {
        signal?.removeEventListener('abort', stop);
      }
    },

    dispose() {}, // the model is shared (src/llm/qwen.js); aborting load() stops a download
  };
}
