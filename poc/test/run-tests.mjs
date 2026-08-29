// SPDX-License-Identifier: Apache-2.0
//
// Node test suite for the LensPub reference engine (PoC).
// Run from anywhere:  node poc/test/run-tests.mjs
//
// Tests the pure engine modules (compile.js, interpret.js, anchor.js,
// envelope.js, schema-check.js) with plain asserts, then validates the produced
// InterpretationResult against schemas/interpretation-result.schema.json and
// the bundled lens against schemas/lens-manifest.schema.json using Ajv.
//
// This suite tests THIS engine's internals. The specification-level suite any
// engine can run is conformance/ (npm run conformance); it shares no code with
// poc/engine/ by design.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
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
import { checkAgainstSchema, unhandledKeywords } from '../engine/schema-check.js';
import { LENS_MANIFEST_SCHEMA } from '../engine/lens-manifest.schema.js';

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
// schema-check.js — the dependency-free consumer-side schema check
// ---------------------------------------------------------------------------
console.log('schema-check.js');

test('bundled schema module is identical to the normative schema document', () => {
  const canonical = JSON.parse(readFileSync(repoRoot + 'schemas/lens-manifest.schema.json', 'utf8'));
  assert.equal(
    JSON.stringify(LENS_MANIFEST_SCHEMA),
    JSON.stringify(canonical),
    'poc/engine/lens-manifest.schema.js has drifted from schemas/lens-manifest.schema.json; re-copy it'
  );
});

test('the checker understands every keyword the manifest schema uses', () => {
  assert.deepEqual(
    unhandledKeywords(LENS_MANIFEST_SCHEMA),
    [],
    'the schema grew a constraint schema-check.js cannot see, so the consumer has quietly stopped enforcing it'
  );
});

test('undeclared members are rejected wherever they appear', () => {
  // The privacy invariant of ADR-0006 rests on this: a manifest carrying
  // reading history is detectable only because every object closes itself.
  const withHistory = { ...manifest, readingHistory: [{ url: 'https://example.com/a', readAt: '2026-07-08T09:14:00Z' }] };
  const top = validateManifestShape(withHistory);
  assert.equal(top.ok, false);
  assert.match(top.errors.join(' '), /readingHistory/);
  assert.match(top.errors.join(' '), /reading history would hide/);

  const nested = JSON.parse(JSON.stringify(manifest));
  nested.adaptation.feedbackEvents = [{ type: 'more-like-this', at: '2026-07-08T09:14:00Z' }];
  const deep = validateManifestShape(nested);
  assert.equal(deep.ok, false);
  assert.match(deep.errors.join(' '), /\/adaptation has a field 'feedbackEvents'/);
});

test('enumerations, ranges, patterns, and types are enforced', () => {
  const mutate = (fn) => {
    const copy = JSON.parse(JSON.stringify(manifest));
    fn(copy);
    return validateManifestShape(copy);
  };
  assert.match(
    mutate((m) => { m.adaptation.defaultPolicy = 'aggressive'; }).errors.join(' '),
    /\/adaptation\/defaultPolicy must be one of: locked, conservative/
  );
  assert.match(
    mutate((m) => { m.interpretation.priorities[0].weight = 1.5; }).errors.join(' '),
    /\/interpretation\/priorities\/0\/weight must be at most 1/
  );
  assert.match(
    mutate((m) => { m.metadata.lensVersion = '1.4'; }).errors.join(' '),
    /\/metadata\/lensVersion must match/
  );
  assert.match(mutate((m) => { m.metadata.name = 42; }).errors.join(' '), /\/metadata\/name must be a string/);
  assert.match(mutate((m) => { m.lenspub = '0.2'; }).errors.join(' '), /must be "0\.1"/);
  assert.match(mutate((m) => { m.domains = 'health'; }).errors.join(' '), /\/domains must be an array/);
});

test('extensions and proof stay open objects', () => {
  // The schema does not close them, so neither may the checker: a consumer
  // MUST ignore unrecognized extensions entries without failing.
  const open = JSON.parse(JSON.stringify(manifest));
  open.extensions = { 'https://vendor.example/ns': { anything: [1, 2, 3] } };
  open.proof = { type: 'DataIntegrityProof', cryptosuite: 'eddsa-jcs-2022' };
  assert.equal(validateManifestShape(open).ok, true);
});

test('checkAgainstSchema resolves $ref into $defs', () => {
  // sourceList, policyName and policyParameters all reach the document by $ref;
  // an unresolved $ref would silently check nothing.
  const bad = JSON.parse(JSON.stringify(manifest));
  bad.interpretation.sources.trusted[0].weight = 5;      // $defs/sourceList
  bad.adaptation.parameters = { evidenceThreshold: 0 };  // $defs/policyParameters
  const errors = checkAgainstSchema(bad, LENS_MANIFEST_SCHEMA).join(' ');
  assert.match(errors, /\/interpretation\/sources\/trusted\/0\/weight must be at most 1/);
  assert.match(errors, /\/adaptation\/parameters\/evidenceThreshold must be at least 1/);
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
let AjvMod, addFormats;
try {
  AjvMod = require('ajv/dist/2020');
  addFormats = require('ajv-formats');
} catch (err) {
  if (err.code !== 'MODULE_NOT_FOUND') throw err;
  console.error('\nAjv is not installed. Run `npm install` in the repository root, then re-run this suite.');
  process.exit(1);
}
const Ajv = AjvMod.default || AjvMod;
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

test('the dependency-free checker agrees with Ajv across the repository corpus', () => {
  // The consumer-side check in schema-check.js is only worth having if it
  // reaches the same verdict Ajv does. Anything the two disagree about is a
  // manifest this engine would accept and the normative schema would not, or
  // the reverse — either way a conformance defect, not a style difference.
  const corpus = [
    ...readdirSync(repoRoot + 'examples/manifests')
      .filter((f) => f.endsWith('.json'))
      .map((f) => [`examples/manifests/${f}`, JSON.parse(readFileSync(repoRoot + `examples/manifests/${f}`, 'utf8'))]),
    ['poc/lenses/avery-daily.json', manifest],
    ['examples/worked-example/lens.json', JSON.parse(readFileSync(repoRoot + 'examples/worked-example/lens.json', 'utf8'))]
  ];
  const mutations = [
    ['undeclared top-level member', (m) => { m.readingHistory = [{ url: 'https://example.com/a' }]; }],
    ['undeclared nested member', (m) => { m.metadata.lastReadExcerpt = 'a sentence from a page'; }],
    ['policy outside the enumeration', (m) => { m.adaptation.defaultPolicy = 'aggressive'; }],
    ['missing required block', (m) => { delete m.adaptation; }],
    ['wrong protocol version', (m) => { m.lenspub = '0.2'; }],
    ['weight out of range', (m) => { m.interpretation.priorities = [{ topic: 't', weight: 1.5 }]; }],
    ['wrong type', (m) => { m.domains = 'health'; }]
  ];
  for (const [name, doc] of corpus) {
    for (const [label, mutate] of [['unmodified', () => {}], ...mutations]) {
      const copy = JSON.parse(JSON.stringify(doc));
      mutate(copy);
      const ajvOk = Boolean(validateManifest(copy));
      const pocOk = validateManifestShape(copy).ok;
      assert.equal(
        pocOk,
        ajvOk,
        `${name} (${label}): Ajv says ${ajvOk ? 'valid' : 'invalid'}, schema-check.js says ` +
          `${pocOk ? 'valid' : 'invalid'} — ${validateManifestShape(copy).errors.join('; ')}`
      );
    }
  }
});

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
