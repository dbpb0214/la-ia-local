// Page adapter for the anonymizer: load() fits the engine contract in src/engines/index.js,
// detect(text) returns the LLM's findings [{ text, type }] for a page.
// Uses the shared Qwen3-1.7B WebLLM engine (src/llm/qwen.js), also used by Q&A.
import { pack } from '@/translation/text.js';
import { loadQwen, qwen, MODEL, QWEN_INFO } from '@/llm/qwen.js';
import { parseLlmJson, LLM_TYPES } from './detect.js';

const SYSTEM = `You find personal information in US immigration documents (English or Spanish) so it can be redacted.
Return JSON: {"items": [{"text": "<copied exactly from the document>", "type": "<TYPE>"}]}.
TYPE is one of:
- PERSON: any person's name (applicant, relatives, witnesses, preparers)
- ADDRESS: street address, apartment, city/state/ZIP of a residence
- DATE_OF_BIRTH: a birth date
- PASSPORT: passport, visa, national ID, or driver's license numbers
- PHONE, EMAIL
- LOCATION: hometown, village, or city/country of birth
- ORG: employer, school, or church names
Do NOT include form names, government agencies (USCIS, DHS, ICE), or dates that are not birth dates.
If there is nothing to redact, return {"items": []}.`;

// One worked example keeps a small model on the output format.
const EXAMPLE_IN = 'Beneficiary: Luis Ortega Ruiz, born 12/04/1988 in Comalapa, Guatemala. Lives at 45 Elm St Apt 2, Austin, TX 78701. Employer: Rivera Construction LLC. Form I-130 filed 03/02/2021.';
const EXAMPLE_OUT = JSON.stringify({
  items: [
    { text: 'Luis Ortega Ruiz', type: 'PERSON' },
    { text: '12/04/1988', type: 'DATE_OF_BIRTH' },
    { text: 'Comalapa, Guatemala', type: 'LOCATION' },
    { text: '45 Elm St Apt 2, Austin, TX 78701', type: 'ADDRESS' },
    { text: 'Rivera Construction LLC', type: 'ORG' },
  ],
});

const SCHEMA = JSON.stringify({
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: { text: { type: 'string' }, type: { type: 'string', enum: LLM_TYPES } },
        required: ['text', 'type'],
      },
    },
  },
  required: ['items'],
});

export function createAnonymizeEngine({ modelId } = {}) {
  return {
    modelId,

    async load({ onProgress, signal }) {
      await loadQwen({ onProgress, signal });
      onProgress({ phase: 'ready', raw: { ready: MODEL }, info: QWEN_INFO });
    },

    // ~1,500-char chunks keep the prompt inside the 4k context and the reply under max_tokens.
    async detect(text, { signal } = {}) {
      const engine = qwen();
      const stop = () => engine.interruptGenerate();
      signal?.addEventListener('abort', stop);
      try {
        const items = [];
        for (const chunk of pack(text.split('\n'), '\n')) {
          signal?.throwIfAborted();
          if (!chunk.trim()) continue;
          const res = await engine.chat.completions.create({
            messages: [
              { role: 'system', content: SYSTEM },
              { role: 'user', content: EXAMPLE_IN },
              { role: 'assistant', content: EXAMPLE_OUT },
              { role: 'user', content: chunk },
            ],
            temperature: 0,
            max_tokens: 1024,
            response_format: { type: 'json_object', schema: SCHEMA },
            extra_body: { enable_thinking: false }, // Qwen3: no <think> block
          });
          const reply = res.choices[0]?.message?.content ?? '';
          console.info('[anonymize] llm reply', reply);
          items.push(...parseLlmJson(reply));
        }
        signal?.throwIfAborted();
        return items;
      } finally {
        signal?.removeEventListener('abort', stop);
      }
    },

    generate() {
      return Promise.reject(new Error('Anonymizer has no prompt mode; upload a PDF instead'));
    },

    dispose() {}, // the model is shared (src/llm/qwen.js); aborting load() stops a download
  };
}
