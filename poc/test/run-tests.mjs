// SPDX-License-Identifier: Apache-2.0
//
// Node test suite for the LensPub reference engine (PoC).
// Run from anywhere:  node poc/test/run-tests.mjs
//
// Tests the pure engine modules (compile.js, interpret.js, anchor.js,
// envelope.js) with plain asserts, then validates the produced
// InterpretationResult against schemas/interpretation-result.schema.json and
// the bundled lens against schemas/lens-manifest.schema.json using Ajv.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import {
  compileManifest,
  validateManifestShape,
  matchesOrigin,
  topicPattern,
  PRESENTATION_DEFAULTS
} from '../engine/compile.js';
import { interpret, splitSentences, fnv1a32 } from '../engine/interpret.js';
import {
  buildTextQuoteSelector,
  locateQuote,
  normalizeWhitespace,
  CONTEXT_LENGTH
} from '../engine/anchor.js';
import { buildEnvelope, ENGINE_ID, ENGINE_VERSION, CAPABILITY_TIER } from '../engine/envelope.js';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const lensPath = fileURLToPath(new URL('../lenses/avery-daily.json', import.meta.url));

const manifest = JSON.parse(readFileSync(lensPath, 'utf8'));

// ---------------------------------------------------------------------------
// Minimal harness
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok    ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  FAIL  ${name}`);
    console.error('        ' + String(err.message).split('\n').join('\n        '));
  }
}

/** RFC 6901 JSON Pointer resolution, used to check manifestRefs are real. */
function resolvePointer(doc, pointer) {
  if (pointer === '') return doc;
  assert.equal(pointer[0], '/', `JSON Pointer must start with '/': ${pointer}`);
  return pointer
    .split('/')
    .slice(1)
    .map((t) => t.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce((acc, tok) => (acc === undefined || acc === null ? undefined : acc[tok]), doc);
}

// ---------------------------------------------------------------------------
// compile.js
// ---------------------------------------------------------------------------
console.log('compile.js');

const rules = compileManifest(manifest);

test('compiles priorities with weights and manifestRefs', () => {
  assert.equal(rules.priorities.length, 4);
  assert.equal(rules.priorities[0].topic, 'local-first software');
  assert.equal(rules.priorities[0].weight, 0.9);
  assert.equal(rules.priorities[0].manifestRef, '/interpretation/priorities/0');
  assert.equal(rules.priorities[3].weight, -0.5);
  for (const p of rules.priorities) {
    assert.notEqual(resolvePointer(manifest, p.manifestRef), undefined, `dangling ref ${p.manifestRef}`);
  }
});

test('topic patterns match case- and separator-insensitively, at word boundaries', () => {
  const p = topicPattern('local-first software');
  assert.ok(p.test('They ship Local-First Software now.'));
  assert.ok(p.test('a local first software pilot'));
  assert.ok(p.test('local-first\nsoftware wrapped across lines'));
  assert.ok(!p.test('nonlocal-first software'), 'must not match inside a longer word');
  assert.ok(!p.test('local-first softwares2'), 'must not match into trailing alphanumerics');
});

test('compiles trusted/distrusted source lists with schema-default weight', () => {
  assert.equal(rules.trusted.length, 1);
  assert.equal(rules.trusted[0].origin, 'example-journal.example');
  assert.equal(rules.trusted[0].manifestRef, '/interpretation/sources/trusted/0');
  assert.equal(rules.distrusted[0].manifestRef, '/interpretation/sources/distrusted/0');
  const noWeight = compileManifest({
    ...manifest,
    interpretation: { sources: { trusted: [{ origin: 'a.example' }] } }
  });
  assert.equal(noWeight.trusted[0].weight, 1, 'schema default weight is 1');
});

test('compiles requireProvenance and presentation flags with defaults', () => {
  assert.equal(rules.requireProvenance.length, 1);
  assert.equal(rules.requireProvenance[0].signal, 'citations');
  assert.equal(rules.requireProvenance[0].manifestRef, '/interpretation/sources/requireProvenance/0');
  assert.equal(rules.presentation.summaries, 'brief');
  assert.equal(rules.presentationRefs.summaries, '/interpretation/presentation/summaries');
  const bare = compileManifest({
    lenspub: '0.1',
    type: 'LensManifest',
    metadata: { name: 'Bare', lensVersion: '0.1.0' },
    interpretation: {},
    adaptation: { defaultPolicy: 'locked' }
  });
  assert.deepEqual(bare.presentation, PRESENTATION_DEFAULTS);
  assert.equal(bare.presentationRefs.summaries, null, 'no manifestRef for defaulted fields');
});

test('matchesOrigin: registrable domain, subdomain, full origin, DID, junk', () => {
  assert.ok(matchesOrigin('https://example-journal.example/a/b', 'example-journal.example'));
  assert.ok(matchesOrigin('https://www.example-journal.example/x', 'example-journal.example'));
  assert.ok(matchesOrigin('https://example.com/x', 'https://example.com'));
  assert.ok(!matchesOrigin('https://notexample-journal.example/', 'example-journal.example'));
  assert.ok(!matchesOrigin('https://example.com/', 'contentmill.example'));
  assert.ok(!matchesOrigin('https://example.com/', 'did:example:123'), 'DIDs are not resolved by the PoC');
  assert.ok(!matchesOrigin('file:///home/user/demo.html', 'example-journal.example'), 'file URLs have no host');
  assert.ok(!matchesOrigin('not a url', 'example.com'));
});

test('validateManifestShape rejects non-manifests with readable errors', () => {
  assert.equal(validateManifestShape(manifest).ok, true);
  const bad = validateManifestShape({ hello: 'world' });
  assert.equal(bad.ok, false);
  const text = bad.errors.join(' ');
  for (const needle of ['lenspub', 'LensManifest', 'metadata', 'interpretation', 'adaptation']) {
    assert.ok(text.includes(needle), `error text should mention ${needle}: ${text}`);
  }
  assert.equal(validateManifestShape(null).ok, false);
  assert.equal(validateManifestShape([1, 2]).ok, false);
  assert.throws(() => compileManifest({}), /Invalid Lens Manifest/);
});

// ---------------------------------------------------------------------------
// interpret.js
// ---------------------------------------------------------------------------
console.log('interpret.js');

const context = {
  url: 'https://example-journal.example/articles/local-ai-schools',
  title: 'School districts adopt local AI tools',
  textBlocks: [
    {
      text: 'The district is piloting local-first software that keeps student records on classroom machines rather than in the cloud.',
      blockIndex: 0,
      tag: 'p',
      linkCount: 0
    },
    {
      text: 'An internal review found that 73 percent of teacher laptops were missing critical updates at the start of the year.',
      blockIndex: 1,
      tag: 'p',
      linkCount: 0
    },
    {
      text: 'A state audit published in 2024 found gaps in vendor contracts, with 40 districts affected according to the report.',
      blockIndex: 2,
      tag: 'p',
      linkCount: 2
    },
    {
      text: 'Parents asked how school cybersecurity training would change for staff next year.',
      blockIndex: 3,
      tag: 'p',
      linkCount: 0
    }
  ]
};

const result = interpret(context, rules);

test('result envelope and top-level structure', () => {
  assert.equal(result.lenspub, '0.1');
  assert.equal(result.type, 'InterpretationResult');
  assert.equal(result.target.source, context.url);
  assert.equal(result.target.title, context.title);
  assert.match(result.target.contentHash, /^fnv1a32:[0-9a-f]{8}$/);
  assert.equal(result.lens.id, manifest.id);
  assert.equal(result.lens.lensVersion, '1.4.2');
  assert.equal(result.envelope.engine.id, ENGINE_ID);
  assert.equal(result.envelope.engine.version, ENGINE_VERSION);
  assert.equal(result.envelope.engine.capabilityTier, CAPABILITY_TIER);
  assert.equal(result.envelope.execution.location, 'local');
  assert.equal(result.envelope.model, undefined, 'rule-based tier uses no model');
  assert.equal(result.envelope.promptTemplate, undefined, 'rule-based tier has no prompt template');
  assert.ok(!Number.isNaN(Date.parse(result.envelope.generatedAt)));
});

test('every annotation has a non-empty reasoning trace', () => {
  assert.ok(result.annotations.length > 0);
  for (const a of result.annotations) {
    assert.equal(typeof a.reasoning, 'string');
    assert.ok(a.reasoning.trim().length > 0, `empty reasoning on ${a.id}`);
  }
});

test('every evidence-class annotation carries a basis (ADR-0007)', () => {
  const evidenceKinds = ['evidence-indicator', 'counterpoint', 'primary-source'];
  const evidence = result.annotations.filter((a) => evidenceKinds.includes(a.kind));
  assert.ok(evidence.length >= 2, 'expected origin + citations indicators');
  for (const a of evidence) {
    assert.ok(Array.isArray(a.basis) && a.basis.length > 0, `missing basis on ${a.id}`);
    for (const b of a.basis) assert.equal(typeof b.type, 'string');
  }
});

test('all manifestRefs are JSON Pointers into the real manifest', () => {
  let seen = 0;
  for (const a of result.annotations) {
    for (const ref of a.manifestRefs || []) {
      seen += 1;
      assert.notEqual(resolvePointer(manifest, ref), undefined, `dangling manifestRef ${ref} on ${a.id}`);
    }
  }
  assert.ok(seen > 0, 'expected at least one manifestRef across the result');
});

test('priority matches produce highlights citing priority, weight, and pointer', () => {
  const highlights = result.annotations.filter((a) => a.kind === 'highlight');
  assert.equal(highlights.length, 2, 'local-first software + school cybersecurity');
  const lf = highlights.find((a) => a.manifestRefs.includes('/interpretation/priorities/0'));
  assert.ok(lf, 'highlight for local-first software');
  assert.equal(lf.anchor.selectors[0].type, 'TextQuoteSelector');
  assert.match(lf.anchor.selectors[0].exact, /local-first software/i);
  assert.equal(lf.anchor.status, 'exact');
  assert.ok(lf.reasoning.includes('local-first software'));
  assert.ok(lf.reasoning.includes('0.9'), 'reasoning cites the weight');
  assert.ok(lf.reasoning.includes('/interpretation/priorities/0'), 'reasoning cites the pointer');
  const sc = highlights.find((a) => a.manifestRefs.includes('/interpretation/priorities/1'));
  assert.ok(sc, 'highlight for school cybersecurity');
  assert.match(sc.anchor.selectors[0].exact, /school cybersecurity/i);
  const negative = result.annotations.find((a) => (a.manifestRefs || []).includes('/interpretation/priorities/3'));
  assert.equal(negative, undefined, 'negative-weight priority produces no highlight');
});

test('trusted-origin evidence indicator is document-level with source basis', () => {
  const origin = result.annotations.find(
    (a) => a.kind === 'evidence-indicator' && a.manifestRefs.includes('/interpretation/sources/trusted/0')
  );
  assert.ok(origin, 'expected trusted-origin indicator');
  assert.equal(origin.anchor.status, 'document');
  assert.equal(origin.basis[0].type, 'source');
  assert.equal(origin.basis[0].uri, 'https://example-journal.example');
  assert.ok(origin.reasoning.includes('example-journal.example'));
  assert.ok(origin.reasoning.includes('not a statement about whether'), 'no truth verdict');
});

test('distrusted origin fires on a contentmill.example URL', () => {
  const r2 = interpret({ ...context, url: 'https://news.contentmill.example/story' }, rules);
  const flag = r2.annotations.find(
    (a) => a.kind === 'evidence-indicator' && a.manifestRefs.includes('/interpretation/sources/distrusted/0')
  );
  assert.ok(flag, 'expected distrusted-origin indicator');
  assert.equal(flag.anchor.status, 'document');
  assert.ok(flag.body.value.includes('distrusted'));
  const trustedFlag = r2.annotations.find((a) =>
    (a.manifestRefs || []).includes('/interpretation/sources/trusted/0')
  );
  assert.equal(trustedFlag, undefined, 'trusted indicator must not fire on contentmill');
});

test('uncited-statistic heuristic fires only on linkless numeric blocks, honestly', () => {
  const cites = result.annotations.filter(
    (a) => a.kind === 'evidence-indicator' && a.manifestRefs.includes('/interpretation/sources/requireProvenance/0')
  );
  assert.equal(cites.length, 1, 'only the 73-percent block (block 2 has links, others have no numbers)');
  const c = cites[0];
  assert.match(c.anchor.selectors[0].exact, /73 percent/);
  assert.equal(c.anchor.status, 'exact');
  assert.equal(c.basis[0].type, 'citation');
  assert.match(c.reasoning, /heuristic/i, 'reasoning admits it is a heuristic');
  assert.match(c.basis[0].description, /not evidence that the claim is wrong/i);
});

test('document summary is rule-based first-sentences extraction', () => {
  const summaries = result.annotations.filter((a) => a.kind === 'summary');
  assert.equal(summaries.length, 1);
  const s = summaries[0];
  assert.equal(s.anchor.status, 'document');
  assert.ok(s.body.value.startsWith('The district is piloting local-first software'));
  assert.match(s.reasoning, /extractive/i);
  assert.match(s.reasoning, /first sentence/i);
  assert.deepEqual(s.manifestRefs, ['/interpretation/presentation/summaries']);
});

test("presentation.summaries 'none' suppresses the summary", () => {
  const noSummary = compileManifest(JSON.parse(JSON.stringify(manifest)));
  noSummary.presentation.summaries = 'none';
  const r = interpret(context, noSummary);
  assert.equal(r.annotations.filter((a) => a.kind === 'summary').length, 0);
});

test('splitSentences and fnv1a32 behave', () => {
  const s = splitSentences('One fish. Two fish! Red fish?');
  assert.equal(s.length, 3);
  assert.equal(s[1].text, 'Two fish!');
  assert.equal('One fish. Two fish! Red fish?'.slice(s[1].start, s[1].end), 'Two fish!');
  assert.equal(fnv1a32(''), '811c9dc5');
  assert.equal(fnv1a32('a'), fnv1a32('a'));
  assert.notEqual(fnv1a32('a'), fnv1a32('b'));
});

// ---------------------------------------------------------------------------
// anchor.js
// ---------------------------------------------------------------------------
console.log('anchor.js');

test('buildTextQuoteSelector produces exact with <=32-char context', () => {
  const text = 'x'.repeat(100) + 'THE QUOTE' + 'y'.repeat(100);
  const sel = buildTextQuoteSelector(text, 100, 109);
  assert.equal(sel.type, 'TextQuoteSelector');
  assert.equal(sel.exact, 'THE QUOTE');
  assert.equal(sel.prefix.length, CONTEXT_LENGTH);
  assert.equal(sel.suffix.length, CONTEXT_LENGTH);
  assert.equal(sel.prefix, 'x'.repeat(32));
  const early = buildTextQuoteSelector('abcdef', 0, 3);
  assert.equal(early.prefix, '');
  assert.equal(early.suffix, 'def');
});

test('locateQuote: exact match, disambiguated by prefix/suffix', () => {
  const hay = 'alpha beta gamma beta delta';
  const sel = { type: 'TextQuoteSelector', exact: 'beta', prefix: 'gamma ', suffix: ' delta' };
  const loc = locateQuote(hay, sel);
  assert.equal(loc.status, 'exact');
  assert.equal(hay.slice(loc.start, loc.end), 'beta');
  assert.equal(loc.start, 17, 'context selects the second occurrence');
});

test('locateQuote: whitespace-mangled content degrades, with correct offsets', () => {
  const original = 'Districts reported that 73 percent of laptops were unpatched.';
  const sel = buildTextQuoteSelector(original, 24, 34); // "73 percent"
  const mangled = 'Districts   reported\n\tthat 73\n percent of laptops were unpatched.';
  const loc = locateQuote(mangled, sel);
  assert.equal(loc.status, 'degraded');
  assert.equal(normalizeWhitespace(mangled.slice(loc.start, loc.end)), '73 percent');
});

test('locateQuote: missing quote is unanchored, never guessed', () => {
  const loc = locateQuote('completely unrelated text', {
    type: 'TextQuoteSelector',
    exact: 'no such passage',
    prefix: '',
    suffix: ''
  });
  assert.equal(loc.status, 'unanchored');
  assert.equal(loc.start, -1);
  assert.equal(locateQuote('text', { type: 'CssSelector', value: 'html' }).status, 'unanchored');
  assert.equal(locateQuote('text', { type: 'TextQuoteSelector', exact: '' }).status, 'unanchored');
});

// ---------------------------------------------------------------------------
// envelope.js
// ---------------------------------------------------------------------------
console.log('envelope.js');

test('envelope has required fields, rule-based tier, local execution', () => {
  const env = buildEnvelope();
  assert.equal(env.engine.id, 'lenspub-poc');
  assert.equal(env.engine.version, ENGINE_VERSION);
  assert.equal(env.engine.capabilityTier, 'rule-based');
  assert.equal(env.execution.location, 'local');
  assert.ok(!('model' in env));
  assert.ok(!('promptTemplate' in env));
  const t = Date.parse(env.generatedAt);
  assert.ok(Math.abs(Date.now() - t) < 10_000, 'generatedAt is now-ish ISO 8601');
});

// ---------------------------------------------------------------------------
// Schema validation with Ajv (normative schemas in /schemas)
// ---------------------------------------------------------------------------
console.log('schema validation (Ajv)');

const require = createRequire(import.meta.url);
const AjvMod = require('/home/claude/node_modules/ajv/dist/2020');
const Ajv = AjvMod.default || AjvMod;
const addFormats = require('/home/claude/node_modules/ajv-formats');
const ajv = new Ajv({ strict: false });
addFormats(ajv);

const resultSchema = JSON.parse(readFileSync(repoRoot + 'schemas/interpretation-result.schema.json', 'utf8'));
const manifestSchema = JSON.parse(readFileSync(repoRoot + 'schemas/lens-manifest.schema.json', 'utf8'));
const validateResult = ajv.compile(resultSchema);
const validateManifest = ajv.compile(manifestSchema);

test('bundled lens avery-daily.json validates against lens-manifest.schema.json', () => {
  const ok = validateManifest(manifest);
  assert.ok(ok, JSON.stringify(validateManifest.errors, null, 2));
});

test('produced InterpretationResult validates against interpretation-result.schema.json', () => {
  const ok = validateResult(result);
  assert.ok(ok, JSON.stringify(validateResult.errors, null, 2));
});

test('distrusted-origin InterpretationResult also validates', () => {
  const r2 = interpret({ ...context, url: 'https://news.contentmill.example/story' }, rules);
  const ok = validateResult(r2);
  assert.ok(ok, JSON.stringify(validateResult.errors, null, 2));
});

test('empty-page InterpretationResult validates (no blocks, no annotations except none)', () => {
  const r3 = interpret({ url: 'https://example.org/empty', textBlocks: [] }, rules);
  const ok = validateResult(r3);
  assert.ok(ok, JSON.stringify(validateResult.errors, null, 2));
});

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
