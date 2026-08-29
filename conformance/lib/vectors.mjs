// SPDX-License-Identifier: Apache-2.0
//
// Vector loading. Vectors are plain JSON on disk and are validated against
// conformance/vectors/conformance-vector.schema.json before anything runs: a
// vector with a typo in `check` or `expect` would otherwise assert nothing and
// report a pass, which is the one failure mode a conformance suite may not have.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const VECTOR_DIR = 'conformance/vectors';

function walk(dir, out = []) {
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.json') && !entry.endsWith('.schema.json')) out.push(full);
  }
  return out;
}

/**
 * Load every vector, validate it, and check the invariants the schema cannot
 * express: unique ids, and an id whose path agrees with the file it lives in.
 *
 * @param {string} root - repository root.
 * @param {(v: object) => boolean} validateVector - compiled vector schema.
 * @returns {Array<object>} vectors, each with a non-enumerable `_file`.
 */
export function loadVectors(root, validateVector) {
  const files = walk(join(root, VECTOR_DIR));
  const vectors = [];
  const seen = new Map();
  const errors = [];

  for (const file of files) {
    const rel = relative(root, file);
    let doc;
    try {
      doc = JSON.parse(readFileSync(file, 'utf8'));
    } catch (err) {
      errors.push(`${rel}: not parseable as JSON — ${err.message}`);
      continue;
    }
    if (!validateVector(doc)) {
      const detail = validateVector.errors
        .map((e) => `${e.instancePath || '/'} ${e.message}`)
        .join('; ');
      errors.push(`${rel}: does not match conformance-vector.schema.json — ${detail}`);
      continue;
    }
    const expectedRel = `${VECTOR_DIR}/${doc.id}.json`;
    if (rel !== expectedRel) {
      errors.push(`${rel}: id "${doc.id}" implies the path ${expectedRel}`);
      continue;
    }
    if (seen.has(doc.id)) {
      errors.push(`${rel}: duplicate vector id "${doc.id}" (also ${seen.get(doc.id)})`);
      continue;
    }
    seen.set(doc.id, rel);
    Object.defineProperty(doc, '_file', { value: rel, enumerable: false });
    vectors.push(doc);
  }

  return { vectors, errors };
}
