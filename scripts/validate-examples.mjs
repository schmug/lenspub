#!/usr/bin/env node
// Validates every JSON example in the repository against its schema, and
// checks that each counter-example is REJECTED for the reason it exists to
// probe — a schema that silently stopped enforcing an invariant would
// otherwise look exactly like a schema that still does.
// Usage: npm run validate   (or: node scripts/validate-examples.mjs, after `npm install`)
// Licensed Apache-2.0 (see /LICENSE.md).

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Ajv = require('ajv/dist/2020').default || require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ajv = new Ajv({ strict: false });
addFormats(ajv);

const schemas = {
  LensManifest: ajv.compile(JSON.parse(readFileSync(join(root, 'schemas/lens-manifest.schema.json'), 'utf8'))),
  LensDiff: ajv.compile(JSON.parse(readFileSync(join(root, 'schemas/lens-diff.schema.json'), 'utf8'))),
  InterpretationResult: ajv.compile(JSON.parse(readFileSync(join(root, 'schemas/interpretation-result.schema.json'), 'utf8'))),
  // Compiled after LensDiff: it $refs that schema's change-object and
  // manifestRef definitions, which Ajv resolves from the already-registered $id.
  LensChangeProposal: ajv.compile(JSON.parse(readFileSync(join(root, 'schemas/lens-change-proposal.schema.json'), 'utf8'))),
};

const targets = [
  ...readdirSync(join(root, 'examples/manifests')).filter(f => f.endsWith('.json')).map(f => `examples/manifests/${f}`),
  ...readdirSync(join(root, 'examples/diffs')).filter(f => f.endsWith('.json')).map(f => `examples/diffs/${f}`),
  ...readdirSync(join(root, 'examples/proposals')).filter(f => f.endsWith('.json')).map(f => `examples/proposals/${f}`),
  'examples/worked-example/lens.json',
  'examples/worked-example/lens-diff.json',
  'examples/worked-example/interpretation-result.json',
  'poc/lenses/avery-daily.json',
];

let failures = 0;
for (const rel of targets) {
  const doc = JSON.parse(readFileSync(join(root, rel), 'utf8'));
  const validate = schemas[doc.type];
  if (!validate) {
    console.error(`FAIL  ${rel} — unknown type "${doc.type}"`);
    failures++;
    continue;
  }
  if (validate(doc)) {
    console.log(`VALID ${rel} (${doc.type})`);
  } else {
    console.error(`FAIL  ${rel}\n${JSON.stringify(validate.errors, null, 2)}`);
    failures++;
  }
}

// Counter-examples must FAIL, and must fail on the stated keyword. They prove
// that a privacy invariant is enforced by schema structure rather than only
// described in prose: a Lens Change Proposal cannot carry raw history in its
// evidence summary (ADR-0006; spec/adaptation-model.md Section 3.3, item 4).
const counterExamples = [
  {
    file: 'examples/proposals/counter-examples/evidence-summary-with-urls.json',
    keyword: 'additionalProperties',
    why: 'evidence summary carrying URLs and a content excerpt'
  },
  {
    file: 'examples/proposals/counter-examples/evidence-summary-with-timestamps.json',
    keyword: 'additionalProperties',
    why: 'evidence summary carrying per-event timestamps'
  },
  {
    file: 'examples/proposals/counter-examples/evidence-summary-with-event-records.json',
    keyword: 'additionalProperties',
    why: 'evidence summary carrying individual feedback event records'
  }
];

for (const { file, keyword, why } of counterExamples) {
  const doc = JSON.parse(readFileSync(join(root, file), 'utf8'));
  const validate = schemas[doc.type];
  if (!validate) {
    console.error(`FAIL  ${file} — unknown type "${doc.type}"`);
    failures++;
    continue;
  }
  if (validate(doc)) {
    console.error(`FAIL  ${file} — validated, but must be rejected: ${why}`);
    failures++;
  } else if (!validate.errors.some(e => e.keyword === keyword)) {
    console.error(
      `FAIL  ${file} — rejected, but not on "${keyword}" (${why})\n${JSON.stringify(validate.errors, null, 2)}`
    );
    failures++;
  } else {
    console.log(`REJECT ${file} (${doc.type}: ${why})`);
  }
}

if (failures) {
  console.error(`\n${failures} file(s) failed validation.`);
  process.exit(1);
}
console.log(`\nAll ${targets.length} examples valid; all ${counterExamples.length} counter-examples rejected.`);
