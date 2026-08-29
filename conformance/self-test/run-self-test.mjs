#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Tests for the conformance suite itself.  npm run conformance:self-test
//
// A conformance suite is a claim about other people's software, so it needs its
// own evidence. Three properties matter and none of them is visible from a
// green run against the reference engine:
//
//   1. The negative vectors bite. An engine that accepts everything must fail
//      them — otherwise the suite certifies permissiveness as conformance.
//   2. Nothing passes by not running. An adapter that declares no roles must
//      skip everything and pass nothing.
//   3. Every vector is exercised by something. Vectors that no fixture ever
//      runs are untested code wearing the costume of coverage.
//
// The fixtures live beside this file. mock-spec-literal.mjs covers the two
// roles the reference PoC does not implement; mock-permissive.mjs is the engine
// that says yes to everything; subprocess-engine.mjs proves the wire protocol
// an engine in another language would use.

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileSchemas } from '../lib/schemas.mjs';
import { loadVectors } from '../lib/vectors.mjs';
import { loadAdapter, runVectors } from '../run.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const AREAS = ['manifest', 'anchoring', 'adaptation', 'privacy'];

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok    ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  FAIL  ${name}`);
    console.error('        ' + String(err.message).split('\n').join('\n        '));
  }
}

const schemas = compileSchemas(root);
const { vectors, errors } = loadVectors(root, schemas.vector);
const byId = (results) => new Map(results.map((r) => [r.vector.id, r]));
const run = async (path) => runVectors(vectors, await loadAdapter(root, path), { schemas, root });

let pocResults;
async function runPoc() {
  if (!pocResults) pocResults = await run('poc/conformance-adapter.mjs');
  return pocResults;
}

// ---------------------------------------------------------------------------
console.log('vectors');

await test('every vector file parses, validates, and is uniquely identified', () => {
  assert.deepEqual(errors, []);
  assert.ok(vectors.length >= 40, `expected a substantial vector set, found ${vectors.length}`);
});

await test('every coverage area has at least one positive and one negative vector', () => {
  // docs/roadmap.md names four coverage areas for the Phase 1 suite. A vector
  // set that only ever asserts the required behaviour cannot distinguish a
  // conforming engine from a permissive one, so both polarities are required
  // in each — this check is what keeps that true as vectors are added.
  for (const area of AREAS) {
    const inArea = vectors.filter((v) => v.area === area);
    assert.ok(inArea.length > 0, `no vectors in area "${area}"`);
    for (const polarity of ['positive', 'negative']) {
      assert.ok(
        inArea.some((v) => v.polarity === polarity),
        `area "${area}" has no ${polarity} vector`
      );
    }
  }
});

await test('every vector cites a normative document that exists in this repository', () => {
  for (const v of vectors) {
    assert.ok(existsSync(join(root, v.requirement.document)), `${v.id}: no such document ${v.requirement.document}`);
    if (v.requirement.adr) {
      assert.ok(existsSync(join(root, v.requirement.adr)), `${v.id}: no such ADR ${v.requirement.adr}`);
    }
  }
});

// ---------------------------------------------------------------------------
console.log('skipping is not passing');

const example = await run('conformance/adapters/example-adapter.mjs');

await test('an adapter declaring no roles is credited with nothing it did not do', () => {
  // Vectors that assert a property of a normative schema carry no `role` and
  // need no engine, so they run for everyone and are not a claim about the
  // adapter. Every vector that does name a role must skip here, and no such
  // vector may report a pass: an implementation is credited only with what it
  // demonstrates, and this adapter demonstrates nothing.
  for (const r of example) {
    if (r.vector.role) {
      assert.equal(r.outcome, 'SKIP', `${r.vector.id}: expected SKIP, got ${r.outcome}`);
      assert.match(r.detail, /does not declare/);
    } else {
      assert.equal(r.vector.check, 'schema.validate', `${r.vector.id}: a role-free vector must be a schema assertion`);
    }
  }
  assert.equal(example.filter((r) => r.outcome === 'FAIL').length, 0, 'an empty adapter should fail nothing either');
});

await test('a vector scoped to another capability tier is skipped, not failed', async () => {
  const poc = byId(await runPoc());
  for (const v of vectors.filter((x) => x.requiresTier)) {
    const r = poc.get(v.id);
    assert.equal(r.outcome, 'SKIP', `${v.id}: expected SKIP for a rule-based engine, got ${r.outcome}`);
    assert.match(r.detail, /tier/);
  }
});

// ---------------------------------------------------------------------------
console.log('the reference engine and the spec-literal fixture');

await test('the reference PoC fails no vector applicable to it', async () => {
  const results = await runPoc();
  const failures = results.filter((r) => r.outcome === 'FAIL');
  assert.deepEqual(
    failures.map((r) => `${r.vector.id}: ${r.detail}`),
    [],
    'the reference implementation must pass its own protocol’s conformance suite'
  );
  assert.ok(results.some((r) => r.outcome === 'PASS'), 'the PoC passed nothing at all');
});

await test('the spec-literal fixture fails no vector applicable to it', async () => {
  const results = await run('conformance/self-test/mock-spec-literal.mjs');
  assert.deepEqual(results.filter((r) => r.outcome === 'FAIL').map((r) => `${r.vector.id}: ${r.detail}`), []);
});

await test('every vector is exercised by a fixture, except those scoped to a model tier', async () => {
  const poc = byId(await runPoc());
  const literal = byId(await run('conformance/self-test/mock-spec-literal.mjs'));
  const neverRun = vectors
    .filter((v) => poc.get(v.id).outcome === 'SKIP' && literal.get(v.id).outcome === 'SKIP')
    .map((v) => v.id)
    .sort();
  const tierScoped = vectors.filter((v) => v.requiresTier).map((v) => v.id).sort();
  assert.deepEqual(
    neverRun,
    tierScoped,
    'a vector no fixture runs is untested. Either a fixture should cover it, or it is tier-scoped and the suite ' +
      'should say so — the reference engine is rule-based, so model-tier vectors are legitimately unexercised here.'
  );
});

// ---------------------------------------------------------------------------
console.log('the negative vectors bite');

const permissive = byId(await run('conformance/self-test/mock-permissive.mjs'));

await test('an engine that accepts everything fails every adapter-driven negative vector', () => {
  const applicable = vectors.filter(
    (v) => v.polarity === 'negative' && v.role && !v.requiresTier
  );
  assert.ok(applicable.length >= 15, `expected a substantial negative set, found ${applicable.length}`);
  const survived = applicable.filter((v) => permissive.get(v.id).outcome !== 'FAIL').map((v) => v.id);
  assert.deepEqual(
    survived,
    [],
    'these negative vectors were passed or skipped by an engine that refuses nothing, so they assert nothing'
  );
});

await test('auto-acceptance above the ceiling is reported as a conformance violation', () => {
  // The boundary spec/adaptation-model.md Section 2 names outright. The suite
  // must not report it as an ordinary mismatch.
  const r = permissive.get('adaptation/auto-accept-above-ceiling-is-a-conformance-violation');
  assert.equal(r.outcome, 'FAIL');
  assert.equal(r.violation, true, 'the ceiling breach must be labelled a conformance violation');
  assert.match(r.detail, /auto-accept/);
});

await test('guess-anchoring is reported as a conformance violation', () => {
  const r = permissive.get('anchoring/unanchored-when-quote-is-absent');
  assert.equal(r.outcome, 'FAIL');
  assert.equal(r.violation, true);
});

await test('a differ that tolerates an undeclared field is reported as a conformance violation', () => {
  const r = permissive.get('privacy/differ-refuses-input-with-an-undeclared-field');
  assert.equal(r.outcome, 'FAIL');
  assert.equal(r.violation, true);
});

await test('interpreting remotely without an opt-in breaks an unconditional invariant', () => {
  const r = permissive.get('privacy/no-remote-execution-without-an-opted-in-scope');
  assert.equal(r.outcome, 'FAIL');
  assert.equal(r.violation, true);
  assert.match(r.detail, /does not opt in/);
});

await test('an engine that refuses everything fails the positive consumer vectors', async () => {
  // The other half of the pincer. Without it, "reject everything" would be a
  // winning strategy against the whole negative set.
  const refuseEverything = {
    name: 'refuse-everything-fixture',
    version: '0.0.0',
    capabilityTier: 'rule-based',
    roles: ['manifest-consumer'],
    validateManifest: () => ({ accepted: false, errors: ['no'] })
  };
  const results = byId(await runVectors(vectors, refuseEverything, { schemas, root }));
  for (const id of ['manifest/consumer-accepts-conforming-manifest', 'manifest/consumer-accepts-unknown-extensions-entry']) {
    assert.equal(results.get(id).outcome, 'FAIL', `${id} should fail an engine that accepts nothing`);
  }
});

// ---------------------------------------------------------------------------
console.log('wiring an engine that is not written in JavaScript');

await test('the subprocess adapter reaches the same verdicts as the in-process fixture', async () => {
  process.env.LENSPUB_CONFORMANCE_ENGINE = 'node conformance/self-test/subprocess-engine.mjs';
  const viaPipe = byId(await run('conformance/adapters/subprocess-adapter.mjs'));
  const inProcess = byId(await run('conformance/self-test/mock-spec-literal.mjs'));
  const disagreements = vectors
    .filter((v) => viaPipe.get(v.id).outcome !== inProcess.get(v.id).outcome)
    .map((v) => `${v.id}: pipe ${viaPipe.get(v.id).outcome} vs in-process ${inProcess.get(v.id).outcome}`);
  assert.deepEqual(disagreements, [], 'the wire protocol changed the verdict, which makes it unusable for conformance');
});

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
