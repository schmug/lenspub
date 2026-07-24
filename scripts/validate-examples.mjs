#!/usr/bin/env node
// Validates every JSON example in the repository against its schema.
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
};

const targets = [
  ...readdirSync(join(root, 'examples/manifests')).filter(f => f.endsWith('.json')).map(f => `examples/manifests/${f}`),
  ...readdirSync(join(root, 'examples/diffs')).filter(f => f.endsWith('.json')).map(f => `examples/diffs/${f}`),
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

if (failures) {
  console.error(`\n${failures} file(s) failed validation.`);
  process.exit(1);
}
console.log(`\nAll ${targets.length} examples valid.`);
