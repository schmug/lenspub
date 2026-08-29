// SPDX-License-Identifier: Apache-2.0
//
// Ajv wiring for the conformance suite. Compiles the four normative schemas in
// /schemas plus the suite's own vector schema. Kept separate from the checks so
// that a runner written in another language has one obvious thing to replace.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function loadAjv() {
  try {
    const AjvMod = require('ajv/dist/2020');
    const addFormats = require('ajv-formats');
    return { Ajv: AjvMod.default || AjvMod, addFormats };
  } catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND') throw err;
    console.error('Ajv is not installed. Run `npm install` in the repository root, then re-run the suite.');
    process.exit(1);
  }
}

/**
 * Compile every schema the suite needs.
 *
 * The LensDiff schema is compiled before LensChangeProposal because the latter
 * $refs the former's change-object and manifestRef definitions, which Ajv
 * resolves from the already-registered $id.
 *
 * @param {string} root - repository root.
 */
export function compileSchemas(root) {
  const { Ajv, addFormats } = loadAjv();
  const ajv = new Ajv({ strict: false, allErrors: true });
  addFormats(ajv);

  const read = (rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));
  const normative = {
    LensManifest: ajv.compile(read('schemas/lens-manifest.schema.json')),
    LensDiff: ajv.compile(read('schemas/lens-diff.schema.json')),
    InterpretationResult: ajv.compile(read('schemas/interpretation-result.schema.json')),
    LensChangeProposal: ajv.compile(read('schemas/lens-change-proposal.schema.json'))
  };
  const vector = ajv.compile(read('conformance/vectors/conformance-vector.schema.json'));
  return { normative, vector };
}
