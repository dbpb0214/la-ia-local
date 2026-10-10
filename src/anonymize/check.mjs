// Self-check for the pure anonymization logic: `node src/anonymize/check.mjs`
import assert from 'node:assert/strict';
import { ruleSpans } from './rules.js';
import { findAll, label } from './spans.js';
import { detectPage, parseLlmJson } from './detect.js';

const types = (text) => ruleSpans(text).map((s) => `${s.type}=${s.value}`);

assert.deepEqual(types('Alien # A123456789 and A-012-345-678'), ['A_NUMBER=A123456789', 'A_NUMBER=A-012-345-678']);
assert.deepEqual(types('A-Number: 123 456 789'), ['A_NUMBER=123 456 789']);
assert.deepEqual(types('SSN 123-45-6789, ITIN 912-70-1234'), ['SSN=123-45-6789', 'ITIN=912-70-1234']);
assert.deepEqual(types('Receipt IOE0912345678 and wac-1234567890'), ['RECEIPT=IOE0912345678', 'RECEIPT=wac-1234567890']);
assert.deepEqual(types('mail maria.perez+uscis@example.org'), ['EMAIL=maria.perez+uscis@example.org']);
assert.deepEqual(types('call (555) 123-4567 or +1 555.987.6543'), ['PHONE=(555) 123-4567', 'PHONE=+1 555.987.6543']);
assert.deepEqual(types('Filed on 03/02/2021, Form I-130.'), []); // dates/forms are not PII by rule

assert.equal(findAll('Maria  Perez\nGomez', 'maria perez gomez').length, 1); // whitespace + case tolerant
assert.equal(findAll('Mariana', 'Maria').length, 0); // word boundaries
assert.equal(findAll('no such person', 'Juan Lopez').length, 0); // hallucination dropped

const text = 'Maria Perez (A123456789) filed for Jose Perez. MARIA PEREZ signed on 03/02/2021. DOB 01/05/1990.';
const llm = parseLlmJson(
  'Sure:\n```json\n[{"text":"Maria Perez","type":"PERSON"},{"text":"Jose Perez","type":"person"},' +
    '{"text":"A123456789","type":"PASSPORT"},{"text":"03/02/2021","type":"DATE"},{"text":"01/05/1990","type":"date of birth"},' +
    '{"text":"Ghost Name","type":"PERSON"}]\n```'
);
const spans = label(detectPage(text, llm, ['signed']));
const got = spans.map((s) => `${s.label}=${s.value}`);
assert.deepEqual(got, [
  '[PERSON_1]=Maria Perez',
  '[A_NUMBER_1]=A123456789', // regex type beats LLM's PASSPORT guess
  '[PERSON_2]=Jose Perez',
  '[PERSON_1]=MARIA PEREZ', // same person, same label
  '[CUSTOM_1]=signed',
  '[DATE_OF_BIRTH_1]=01/05/1990', // filing date 03/02/2021 kept
]);

assert.deepEqual(parseLlmJson('no json here'), []);
assert.deepEqual(parseLlmJson('[{"text": broken'), []);
// Truncated by max_new_tokens: complete objects survive.
assert.deepEqual(parseLlmJson('[{"text":"Ana","type":"PERSON"},{"text":"Lu'), [{ text: 'Ana', type: 'PERSON' }]);

console.log('anonymize check: ok');
