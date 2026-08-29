// SPDX-License-Identifier: Apache-2.0
//
// Self-test fixture: an adapter that implements, straight from the normative
// tables, the two roles the reference PoC does not have — adaptation-engine and
// differ. It exists so those vectors are exercised by something rather than
// sitting permanently SKIPPED, which would make them untested code masquerading
// as coverage.
//
// It is a fixture, not a second implementation and not a reference. It has no
// engine, interprets nothing, and its differ is deliberately partial: no JCS
// canonicalisation (Section 5.1), terse mechanical summaries, and no `totals`.
// It is written from spec/adaptation-model.md Sections 4, 5 and 6 and
// spec/lens-diff.md Sections 4 through 6 — the same documents the vectors are
// written from, read independently, which is what makes agreement between them
// evidence of anything.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Ajv = require('ajv/dist/2020').default || require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const root = fileURLToPath(new URL('../..', import.meta.url));
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const validateManifest = ajv.compile(JSON.parse(readFileSync(join(root, 'schemas/lens-manifest.schema.json'), 'utf8')));

// --- spec/adaptation-model.md Section 5, the preset table -------------------
const PRESETS = {
  locked: { proposalFrequency: 0, evidenceThreshold: null, autoAcceptCeiling: 'none', exploratoryProposalsPermitted: false },
  conservative: { proposalFrequency: 0.25, evidenceThreshold: 12, autoAcceptCeiling: 'none', exploratoryProposalsPermitted: false },
  balanced: { proposalFrequency: 1, evidenceThreshold: 6, autoAcceptCeiling: 'none', exploratoryProposalsPermitted: false },
  adaptive: { proposalFrequency: 3, evidenceThreshold: 3, autoAcceptCeiling: 'trivial', exploratoryProposalsPermitted: false },
  explorer: { proposalFrequency: 5, evidenceThreshold: 2, autoAcceptCeiling: 'minor', exploratoryProposalsPermitted: true },
  // A custom policy carries no exploratory permission: the v0.1 parameter set
  // has no field granting it, so only the explorer preset ever confers it.
  custom: { proposalFrequency: 0, evidenceThreshold: null, autoAcceptCeiling: 'none', exploratoryProposalsPermitted: false }
};

const CEILING_RANK = { none: -1, trivial: 0, minor: 1 };
const IMPACT_RANK = { trivial: 0, minor: 1, major: 2 };
const effective = (policy, parameters) => ({ ...PRESETS[policy], ...(parameters || {}) });

function resolvePolicy({ manifest, domains }) {
  const perDomain = (manifest.adaptation.domainPolicies || []).filter((e) => (domains || []).includes(e.domain));
  const applicable = perDomain.length
    ? perDomain.map((e) => effective(e.policy, e.parameters))
    : [effective(manifest.adaptation.defaultPolicy, manifest.adaptation.parameters)];

  // Section 6: combine parameter-wise, most restrictive of each — not by
  // choosing whichever single policy looks stricter overall.
  const thresholds = applicable.map((p) => p.evidenceThreshold).filter((t) => typeof t === 'number');
  return {
    proposalFrequency: Math.min(...applicable.map((p) => p.proposalFrequency)),
    evidenceThreshold: thresholds.length ? Math.max(...thresholds) : null,
    autoAcceptCeiling: applicable
      .map((p) => p.autoAcceptCeiling)
      .reduce((lowest, c) => (CEILING_RANK[c] < CEILING_RANK[lowest] ? c : lowest)),
    exploratoryProposalsPermitted: applicable.every((p) => p.exploratoryProposalsPermitted)
  };
}

// --- spec/adaptation-model.md Section 4, impact classification --------------
function impactOf(change) {
  const { op, path, before, after } = change;
  const under = (prefix) => path === prefix || path.startsWith(`${prefix}/`);

  // Always major whatever the size of the edit.
  if (under('/privacy') || under('/adaptation')) return 'major';
  if (op === 'remove') return 'major';
  if (under('/interpretation/sources/distrusted')) return 'major';

  if (under('/subscriptions')) {
    const trust = path.endsWith('/trust') ? after : after && after.trust;
    if (trust === 'adopted') return 'major';
    return op === 'add' && trust === 'advisory' ? 'minor' : 'major';
  }

  if (under('/interpretation/presentation')) return 'trivial';

  if (op === 'replace' && path.endsWith('/weight') && typeof before === 'number' && typeof after === 'number') {
    return Math.abs(after - before) <= 0.2 ? 'minor' : 'major';
  }
  if (op === 'add' && (under('/interpretation/priorities') || under('/interpretation/sources/trusted'))) {
    const weight = after && typeof after.weight === 'number' ? after.weight : 1;
    return Math.abs(weight) <= 0.5 ? 'minor' : 'major';
  }
  return 'major'; // failing toward review is the safe direction
}

// --- spec/adaptation-model.md Sections 2, 3.5 and 5, auto-acceptance --------
function disposeProposal({ policy, proposal }) {
  const origin = proposal.origin || 'user-feedback';
  // Subscription updates originate outside the user's own feedback and do not
  // count against proposalFrequency, so a zero budget does not suppress them.
  if (origin !== 'subscription-update' && policy.proposalFrequency === 0) return { disposition: 'must-not-raise' };
  if (proposal.exploratory) return { disposition: 'require-review' };
  if (IMPACT_RANK[proposal.impact] <= CEILING_RANK[policy.autoAcceptCeiling]) return { disposition: 'auto-accept' };
  return { disposition: 'require-review' };
}

// --- spec/lens-diff.md Sections 4 to 6 --------------------------------------
const EXCLUDED = ['/metadata/lensVersion', '/metadata/modified', '/versionHistory', '/proof'];
const KEYED = {
  '/interpretation/priorities': 'topic',
  '/interpretation/sources/trusted': 'origin',
  '/interpretation/sources/distrusted': 'origin',
  '/adaptation/domainPolicies': 'domain',
  '/subscriptions': 'lens'
};
const CATEGORY = {
  metadata: 'metadata', domains: 'domains', adaptation: 'adaptation',
  privacy: 'privacy', subscriptions: 'subscriptions', extensions: 'extensions'
};

function categoryOf(path) {
  const [, head, second] = path.split('/');
  if (head === 'interpretation') {
    if (second === 'sources') return 'sources';
    if (second === 'presentation') return 'presentation';
    return 'priorities';
  }
  return CATEGORY[head] || 'metadata';
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function record(changes, op, path, before, after) {
  if (EXCLUDED.some((e) => path === e || path.startsWith(`${e}/`))) return;
  const change = { op, path, category: categoryOf(path), impact: '', summary: '' };
  if (op !== 'add') change.before = before;
  if (op !== 'remove') change.after = after;
  change.impact = impactOf(change);
  const value = op === 'remove' ? before : after;
  change.summary =
    op === 'replace'
      ? `${path} changed from ${JSON.stringify(before)} to ${JSON.stringify(after)}.`
      : `${path} was ${op === 'add' ? 'added' : 'removed'} (${JSON.stringify(value)}).`;
  changes.push(change);
}

function compare(from, to, path, changes) {
  if (same(from, to)) return;
  if (Array.isArray(from) && Array.isArray(to) && KEYED[path]) {
    const key = KEYED[path];
    const index = (arr) => new Map(arr.map((el, i) => [el && el[key], { el, i }]));
    const a = index(from);
    const b = index(to);
    for (const [k, { el, i }] of a) if (!b.has(k)) record(changes, 'remove', `${path}/${i}`, el, undefined);
    for (const [k, { el, i }] of b) {
      if (!a.has(k)) record(changes, 'add', `${path}/${i}`, undefined, el);
      else compare(a.get(k).el, el, `${path}/${i}`, changes);
    }
    return;
  }
  if (Array.isArray(from) && Array.isArray(to)) {
    for (let i = 0; i < Math.max(from.length, to.length); i++) {
      if (i >= from.length) record(changes, 'add', `${path}/${i}`, undefined, to[i]);
      else if (i >= to.length) record(changes, 'remove', `${path}/${i}`, from[i], undefined);
      else compare(from[i], to[i], `${path}/${i}`, changes);
    }
    return;
  }
  if (isObject(from) && isObject(to)) {
    for (const key of new Set([...Object.keys(from), ...Object.keys(to)])) {
      const child = `${path}/${key}`;
      if (!(key in to)) record(changes, 'remove', child, from[key], undefined);
      else if (!(key in from)) record(changes, 'add', child, undefined, to[key]);
      else compare(from[key], to[key], child, changes);
    }
    return;
  }
  record(changes, 'replace', path, from, to);
}

function diff({ from, to }) {
  // Section 4, rule 2: refuse, producing no diff, rather than stripping the
  // offending member and diffing the remainder.
  for (const [side, doc] of [['from', from], ['to', to]]) {
    if (!validateManifest(doc)) {
      return {
        refused: true,
        reason: `the "${side}" input does not validate against lens-manifest.schema.json: ` +
          validateManifest.errors.map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ')
      };
    }
  }
  const changes = [];
  compare(from, to, '', changes);
  return {
    refused: false,
    diff: {
      lenspub: '0.1',
      type: 'LensDiff',
      from: { lensVersion: from.metadata.lensVersion },
      to: { lensVersion: to.metadata.lensVersion },
      comparison: 'self-over-time',
      changes
    }
  };
}

export default {
  name: 'spec-literal-fixture',
  version: '0.1.0',
  capabilityTier: 'rule-based',
  roles: ['adaptation-engine', 'differ'],
  resolvePolicy,
  classifyImpact: ({ change }) => impactOf(change),
  disposeProposal,
  diff
};
