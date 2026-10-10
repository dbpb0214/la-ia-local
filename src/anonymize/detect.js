// Pure: one page's text + the LLM's raw findings + user-added terms -> merged spans.
import { ruleSpans } from './rules.js';
import { findAll, merge } from './spans.js';

export const LLM_TYPES = ['PERSON', 'ADDRESS', 'DATE_OF_BIRTH', 'PASSPORT', 'PHONE', 'EMAIL', 'LOCATION', 'ORG'];

export function detectPage(text, llmItems = [], manualTerms = []) {
  const llm = llmItems.flatMap(({ text: needle, type }) => {
    const t = String(type ?? '').toUpperCase().replace(/[\s-]+/g, '_');
    if (t.includes('DATE') && t !== 'DATE_OF_BIRTH') return []; // only birth dates are redacted
    return findAll(text, needle, { type: LLM_TYPES.includes(t) ? t : 'OTHER', source: 'llm' });
  });
  const manual = manualTerms.flatMap((term) => findAll(text, term, { type: 'CUSTOM', source: 'manual' }));
  return merge([...ruleSpans(text), ...llm, ...manual], text);
}

// The model's reply should be a JSON array, but small models wrap it in prose or ``` fences
// and can be cut off by max_new_tokens, so each {...} object is parsed on its own.
export function parseLlmJson(reply) {
  return [...String(reply ?? '').matchAll(/\{[^{}]*\}/g)].flatMap(([obj]) => {
    try {
      const item = JSON.parse(obj);
      return typeof item?.text === 'string' ? [item] : [];
    } catch {
      return [];
    }
  });
}
