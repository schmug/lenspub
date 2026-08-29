#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// LensPub v0.1 conformance suite runner.
//
//   npm run conformance                              # against the reference PoC
//   npm run conformance -- --adapter ./my-engine.mjs # against your engine
//   npm run conformance -- --area anchoring --json
//
// The suite tests the protocol, not any one implementation: it imports nothing
// from poc/engine/, and every implementation reaches it through the single
// adapter interface documented in conformance/ADAPTER.md.

import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

import { compileSchemas } from './lib/schemas.mjs';
import { loadVectors } from './lib/vectors.mjs';
import { CHECKS, ROLE_METHOD } from './lib/checks.mjs';
import { renderText, renderJson } from './lib/report.mjs';

const DEFAULT_ADAPTER = 'poc/conformance-adapter.mjs';
const AREAS = ['manifest', 'anchoring', 'adaptation', 'privacy'];

function parseArgs(argv) {
  const opts = { adapter: DEFAULT_ADAPTER, json: false, area: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--adapter') opts.adapter = argv[++i];
    else if (arg.startsWith('--adapter=')) opts.adapter = arg.slice('--adapter='.length);
    else if (arg === '--json') opts.json = true;
    else if (arg === '--area') opts.area = argv[++i];
    else if (arg.startsWith('--area=')) opts.area = arg.slice('--area='.length);
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else {
      console.error(`Unknown argument: ${arg}`);
      opts.help = true;
    }
  }
  return opts;
}

const USAGE = `
LensPub v0.1 conformance suite

  node conformance/run.mjs [--adapter <path>] [--area <${AREAS.join('|')}>] [--json]

  --adapter   Module whose default export is a conformance adapter.
              Default: ${DEFAULT_ADAPTER}. See conformance/ADAPTER.md.
  --area      Run one coverage area only.
  --json      Emit a machine-readable report on stdout instead of the
              human-readable one. Exit status is unchanged.
`;

/** Load and shape-check an adapter module. Throws with an actionable message. */
export async function loadAdapter(root, spec) {
  const url = pathToFileURL(resolve(root, spec)).href;
  let mod;
  try {
    mod = await import(url);
  } catch (err) {
    throw new Error(`could not load adapter "${spec}": ${err.message}`);
  }
  const adapter = mod.default;
  if (!adapter || typeof adapter !== 'object') {
    throw new Error(`adapter "${spec}" has no default export; see conformance/ADAPTER.md`);
  }
  for (const field of ['name', 'version', 'capabilityTier']) {
    if (typeof adapter[field] !== 'string') throw new Error(`adapter "${spec}" is missing a string "${field}"`);
  }
  if (!['rule-based', 'local-model', 'hosted-model', 'hybrid'].includes(adapter.capabilityTier)) {
    throw new Error(`adapter "${spec}" declares capabilityTier "${adapter.capabilityTier}", which is not one of the four tiers`);
  }
  if (!Array.isArray(adapter.roles)) throw new Error(`adapter "${spec}" is missing a "roles" array`);
  for (const role of adapter.roles) {
    if (!(role in ROLE_METHOD)) {
      throw new Error(`adapter "${spec}" declares unknown role "${role}"; known roles: ${Object.keys(ROLE_METHOD).join(', ')}`);
    }
    for (const method of [ROLE_METHOD[role]].flat()) {
      if (typeof adapter[method] !== 'function') {
        throw new Error(`adapter "${spec}" declares role "${role}" but implements no ${method}()`);
      }
    }
  }
  return adapter;
}

/** Run every vector against one adapter. Never throws for a vector's sake. */
export async function runVectors(vectors, adapter, ctx) {
  const results = [];
  for (const vector of vectors) {
    if (vector.role && !adapter.roles.includes(vector.role)) {
      results.push({
        vector,
        outcome: 'SKIP',
        detail: `adapter does not declare the "${vector.role}" role — not run, and no conformance claim follows`
      });
      continue;
    }
    if (vector.requiresTier && !vector.requiresTier.includes(adapter.capabilityTier)) {
      results.push({
        vector,
        outcome: 'SKIP',
        detail: `applies to the ${vector.requiresTier.join('/')} tier(s); this adapter declares "${adapter.capabilityTier}"`
      });
      continue;
    }
    try {
      const res = await CHECKS[vector.check](vector, adapter, ctx);
      results.push({ vector, ...res });
    } catch (err) {
      results.push({ vector, outcome: 'FAIL', detail: `adapter threw: ${err && err.message ? err.message : String(err)}` });
    }
  }
  return results;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(USAGE.trim());
    process.exit(0);
  }
  if (opts.area && !AREAS.includes(opts.area)) {
    console.error(`Unknown area "${opts.area}". Known areas: ${AREAS.join(', ')}`);
    process.exit(2);
  }

  const root = fileURLToPath(new URL('..', import.meta.url));
  const schemas = compileSchemas(root);
  const { vectors, errors } = loadVectors(root, schemas.vector);
  if (errors.length) {
    for (const e of errors) console.error(`INVALID VECTOR  ${e}`);
    console.error(`\n${errors.length} vector file(s) are not usable. Fix them before drawing any conclusion from a run.`);
    process.exit(2);
  }

  let adapter;
  try {
    adapter = await loadAdapter(root, opts.adapter);
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  const selected = opts.area ? vectors.filter((v) => v.area === opts.area) : vectors;
  const results = await runVectors(selected, adapter, { schemas, root });

  if (opts.json) {
    console.log(JSON.stringify(renderJson(results, adapter), null, 2));
  } else {
    renderText(results, adapter);
  }
  process.exit(results.some((r) => r.outcome === 'FAIL') ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  await main();
}
