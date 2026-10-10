// Self-check for Q&A retrieval: `node src/qa/check.mjs`
import assert from 'node:assert/strict';
import { chunks, pick, words } from './retrieve.js';

assert.deepEqual([...words('¿Cuándo vence el DEPÓSITO?')], ['vence', 'deposito']); // accents, case, stopwords

const filler = (n) => Array.from({ length: 30 }, (_, i) => `Line ${n}-${i} about general office procedures.`).join('\n');
const pages = [
  { text: filler(1) },
  { text: `${filler(2)}\nThe security deposit must be returned within 14 days.` },
  { text: filler(3) },
  { text: '' },
];
const all = chunks(pages);
assert.ok(all.every((c) => c.text.length <= 1500 && c.text.trim()));
assert.deepEqual([...new Set(all.map((c) => c.page))], [1, 2, 3]); // empty page dropped

// Small doc: everything, in order.
assert.deepEqual(pick(all, ['anything'], 1e6), all);

// Large doc: the matching chunk wins, even when only the translated query matches.
const got = pick(all, ['¿Cuándo devuelven el depósito de garantía?', 'When is the security deposit returned?'], 1500);
assert.equal(got.length, 1);
assert.match(got[0].text, /security deposit/);

// Picked chunks come back in page order and respect the budget.
const many = pick(all, ['office'], 3000);
assert.ok(many.reduce((n, c) => n + c.text.length, 0) <= 3000);
assert.deepEqual(many.map((c) => c.page), [...many.map((c) => c.page)].sort((a, b) => a - b));

console.log('qa checks passed');
