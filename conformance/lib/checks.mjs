// SPDX-License-Identifier: Apache-2.0
//
// The eight checks a vector's `check` member may name. Each takes the vector
// and the adapter and returns { outcome, detail, violation? }.
//
// Nothing here imports from poc/ — the suite tests the protocol, and an engine
// that shared code with its own conformance suite would be testing that the two
// copies agree rather than that either conforms.

const IMPACT_RANK = { trivial: 0, minor: 1, major: 2 };
const ANCHOR_STATUSES = ['exact', 'degraded', 'unanchored', 'document'];
const EVIDENCE_KINDS = ['evidence-indicator', 'counterpoint', 'primary-source'];

const pass = (detail = '') => ({ outcome: 'PASS', detail });
const fail = (detail) => ({ outcome: 'FAIL', detail });
const violation = (detail) => ({ outcome: 'FAIL', detail, violation: true });

const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
const asArray = (v) => (Array.isArray(v) ? v : [v]);

function ajvDetail(errors) {
  return (errors || []).map((e) => `${e.instancePath || '/'} ${e.message} [${e.keyword}]`).join('; ');
}

// ---------------------------------------------------------------------------
// schema.validate — a property of a normative schema; needs no adapter.
// ---------------------------------------------------------------------------
function schemaValidate(vector, _adapter, ctx) {
  const { schema, document } = vector.input;
  const validate = ctx.schemas.normative[schema];
  const valid = validate(document);

  if (vector.expect.valid) {
    return valid
      ? pass(`validates against ${schema}`)
      : fail(`expected the document to validate against ${schema}, but it was rejected: ${ajvDetail(validate.errors)}`);
  }

  if (valid) {
    return fail(`expected ${schema} to reject this document, but it validated`);
  }

  // Rejected, as required — but a counter-example that starts being rejected
  // for a different reason is a schema that has stopped enforcing the invariant
  // the vector exists to probe (CONTRIBUTING.md).
  const { keyword, instancePath } = vector.expect.failsOn;
  const hit = validate.errors.find(
    (e) => e.keyword === keyword && (instancePath === undefined || e.instancePath === instancePath)
  );
  if (!hit) {
    const where = instancePath === undefined ? '' : ` at "${instancePath}"`;
    return fail(
      `rejected, but not on "${keyword}"${where} — the invariant this vector probes may no longer be enforced. ` +
      `Reported instead: ${ajvDetail(validate.errors)}`
    );
  }
  return pass(`rejected on "${keyword}"${instancePath ? ` at "${instancePath}"` : ''}`);
}

// ---------------------------------------------------------------------------
// manifest.validate — role: manifest-consumer
// ---------------------------------------------------------------------------
async function manifestValidate(vector, adapter) {
  const res = await adapter.validateManifest(vector.input.manifest);
  if (!res || typeof res.accepted !== 'boolean') {
    return fail('validateManifest must return { accepted: boolean, errors?: string[] } (see conformance/ADAPTER.md)');
  }
  if (res.accepted === vector.expect.accepted) {
    return pass(res.accepted ? 'accepted' : 'rejected');
  }
  return res.accepted
    ? fail('the consumer accepted a document it is required to reject')
    : fail(`the consumer rejected a document it is required to accept: ${(res.errors || []).join('; ') || '(no reason given)'}`);
}

// ---------------------------------------------------------------------------
// anchor.resolve — role: anchor-resolver
// ---------------------------------------------------------------------------
async function anchorResolve(vector, adapter) {
  const { content, selector } = vector.input;
  const res = await adapter.resolveAnchor({ content, selector });
  if (!res || !ANCHOR_STATUSES.includes(res.status)) {
    return fail(`resolveAnchor must return { status, start, end } with status one of ${ANCHOR_STATUSES.join('|')}; got ${JSON.stringify(res)}`);
  }

  const prohibited = vector.expect.prohibitedStatus || [];
  if (prohibited.includes(res.status)) {
    return violation(
      `reported status "${res.status}", which this requirement names a conformance violation, not a difference of quality`
    );
  }

  const allowed = asArray(vector.expect.status);
  if (!allowed.includes(res.status)) {
    return fail(`expected status ${allowed.map((s) => `"${s}"`).join(' or ')}, got "${res.status}"`);
  }

  if (vector.expect.resolvedOffsets && res.status === 'exact') {
    const { start, end } = vector.expect.resolvedOffsets;
    if (res.start !== start || res.end !== end) {
      return fail(
        `resolved to offsets [${res.start}, ${res.end}) but the quote occupies [${start}, ${end}); ` +
        `the engine anchored to text it was not asked to anchor to`
      );
    }
  }

  if (vector.expect.resolvedText && (res.status === 'exact' || res.status === 'degraded')) {
    const span = norm(String(content).slice(res.start, res.end));
    if (span !== norm(vector.expect.resolvedText)) {
      return fail(`resolved span was "${span}", expected "${norm(vector.expect.resolvedText)}" (whitespace collapsed)`);
    }
  }

  return pass(`status "${res.status}"`);
}

// ---------------------------------------------------------------------------
// policy.resolve — role: adaptation-engine
// ---------------------------------------------------------------------------
async function policyResolve(vector, adapter) {
  const res = await adapter.resolvePolicy({ manifest: vector.input.manifest, domains: vector.input.domains || [] });
  if (!res || typeof res !== 'object') {
    return fail('resolvePolicy must return the effective parameter object (see conformance/ADAPTER.md)');
  }
  const wrong = [];
  for (const [key, want] of Object.entries(vector.expect)) {
    if (res[key] !== want) wrong.push(`${key}: expected ${JSON.stringify(want)}, got ${JSON.stringify(res[key])}`);
  }
  return wrong.length ? fail(wrong.join('; ')) : pass('effective parameters match the normative values');
}

// ---------------------------------------------------------------------------
// impact.classify — role: adaptation-engine
// ---------------------------------------------------------------------------
async function impactClassify(vector, adapter) {
  const got = await adapter.classifyImpact({ change: vector.input.change });
  if (!(got in IMPACT_RANK)) {
    return fail(`classifyImpact must return "trivial", "minor" or "major"; got ${JSON.stringify(got)}`);
  }
  const want = vector.expect.atLeast;
  if (IMPACT_RANK[got] < IMPACT_RANK[want]) {
    return violation(
      `classified "${got}", below the required minimum "${want}". Engines MUST classify no lower than the rules of ` +
      `spec/adaptation-model.md Section 4; under-classification is what lets a change slip beneath an auto-accept ceiling`
    );
  }
  return pass(got === want ? `classified "${got}"` : `classified "${got}" — above the required "${want}", which is permitted`);
}

// ---------------------------------------------------------------------------
// proposal.disposition — role: adaptation-engine
// ---------------------------------------------------------------------------
async function proposalDisposition(vector, adapter) {
  const raw = await adapter.disposeProposal({ policy: vector.input.policy, proposal: vector.input.proposal });
  const got = typeof raw === 'string' ? raw : raw && raw.disposition;
  const legal = ['auto-accept', 'require-review', 'must-not-raise'];
  if (!legal.includes(got)) {
    return fail(`disposeProposal must return { disposition } with one of ${legal.join('|')}; got ${JSON.stringify(raw)}`);
  }
  if (got === vector.expect.disposition) return pass(`disposition "${got}"`);

  if ((vector.expect.conformanceViolationIf || []).includes(got)) {
    return violation(
      `disposition "${got}" where "${vector.expect.disposition}" is required. ` +
      `${vector.requirement.document} Section ${vector.requirement.section} names this a conformance violation`
    );
  }
  return fail(`expected disposition "${vector.expect.disposition}", got "${got}"`);
}

// ---------------------------------------------------------------------------
// interpret.result — role: lens-engine
// ---------------------------------------------------------------------------

/**
 * The unconditional protocol invariants (spec/lenspub-protocol.md Section 7.3),
 * applied to every Interpretation Result the suite obtains, whatever the vector
 * asked for. A vector's own assertions are additional, never a substitute.
 */
function universalResultInvariants(result, vector, ctx) {
  const problems = [];
  const validate = ctx.schemas.normative.InterpretationResult;
  if (!validate(result)) {
    problems.push(`result does not validate against interpretation-result.schema.json: ${ajvDetail(validate.errors)}`);
    return problems; // later checks assume the shape the schema guarantees
  }

  for (const a of result.annotations) {
    const id = a.id || `${a.kind} annotation`;
    if (typeof a.reasoning !== 'string' || a.reasoning.trim() === '') {
      problems.push(`${id}: empty reasoning trace (protocol Section 7.3, invariant 2)`);
    }
    if (EVIDENCE_KINDS.includes(a.kind) && !(Array.isArray(a.basis) && a.basis.length > 0)) {
      problems.push(`${id}: evidence-class annotation with no basis (ADR-0007)`);
    }
  }

  // Local-only default: a remote execution must name a scope the manifest opted in.
  const exec = result.envelope.execution;
  if (exec.location === 'remote') {
    const remote = (vector.input.manifest.privacy || {}).remoteInference || {};
    const optedIn = remote.allowed === true && Array.isArray(remote.domains) && remote.domains.includes(exec.optInScope);
    if (!optedIn) {
      problems.push(
        `execution crossed the trust boundary under optInScope ${JSON.stringify(exec.optInScope)}, which this manifest ` +
        `does not opt in (ADR-0005; protocol Section 7.3, invariant 5)`
      );
    }
  }

  // Never guess-anchor: an 'exact' anchor must quote text the content actually contains.
  const haystack = norm([
    vector.input.content.title || '',
    ...vector.input.content.blocks.map((b) => b.text)
  ].join(' '));
  for (const a of result.annotations) {
    if (a.anchor.status !== 'exact') continue;
    const quote = a.anchor.selectors.find((s) => s.type === 'TextQuoteSelector');
    if (!quote || typeof quote.exact !== 'string' || quote.exact === '') continue;
    if (!haystack.includes(norm(quote.exact))) {
      problems.push(
        `${a.id || a.kind}: anchor status "exact" for a quote that does not occur in the supplied content ` +
        `(${JSON.stringify(quote.exact)}) — guess-anchoring (spec/lens-engine.md Section 5.2)`
      );
    }
  }
  return problems;
}

function runAssertion(assertion, result) {
  const anns = result.annotations;
  switch (assertion.kind) {
    case 'annotation-kind-present': {
      const n = anns.filter((a) => a.kind === assertion.annotationKind).length;
      const min = assertion.min ?? 1;
      return n >= min ? null : `expected at least ${min} "${assertion.annotationKind}" annotation(s), got ${n}`;
    }
    case 'annotation-kind-absent': {
      const n = anns.filter((a) => a.kind === assertion.annotationKind).length;
      return n === 0 ? null : `expected no "${assertion.annotationKind}" annotations, got ${n}`;
    }
    case 'annotation-cites-pointer': {
      const cited = anns.some((a) => (a.manifestRefs || []).includes(assertion.pointer));
      return cited ? null : `no annotation cites the manifest pointer "${assertion.pointer}" in its manifestRefs`;
    }
    case 'annotation-count-at-least':
      return anns.length >= assertion.min ? null : `expected at least ${assertion.min} annotation(s), got ${anns.length}`;
    case 'envelope-execution-location': {
      const loc = result.envelope.execution.location;
      return loc === assertion.equals ? null : `envelope.execution.location is "${loc}", expected "${assertion.equals}"`;
    }
    case 'envelope-capability-tier-declared': {
      const tier = result.envelope.engine.capabilityTier;
      return tier ? null : 'envelope.engine.capabilityTier is absent; every engine MUST record its tier on every result';
    }
    case 'envelope-model-declared': {
      const model = result.envelope.model;
      return model && model.id ? null : 'envelope.model is absent; it is REQUIRED whenever a model is used';
    }
    default:
      return `unknown assertion kind "${assertion.kind}"`;
  }
}

async function interpretResult(vector, adapter, ctx) {
  const result = await adapter.interpret({ manifest: vector.input.manifest, content: vector.input.content });
  if (!result || typeof result !== 'object') {
    return fail('interpret must return an Interpretation Result object (see conformance/ADAPTER.md)');
  }

  const universal = universalResultInvariants(result, vector, ctx);
  if (universal.length) {
    return violation(`unconditional protocol invariant(s) broken — ${universal.join(' | ')}`);
  }

  const problems = vector.expect.assertions.map((a) => runAssertion(a, result)).filter(Boolean);
  return problems.length ? fail(problems.join('; ')) : pass(`${vector.expect.assertions.length} assertion(s) held`);
}

// ---------------------------------------------------------------------------
// diff.produce — role: differ
// ---------------------------------------------------------------------------
async function diffProduce(vector, adapter, ctx) {
  const res = await adapter.diff({ from: vector.input.from, to: vector.input.to });
  if (!res || typeof res.refused !== 'boolean') {
    return fail('diff must return { refused: boolean, reason?: string, diff?: object } (see conformance/ADAPTER.md)');
  }

  if (vector.expect.refused) {
    if (!res.refused) {
      return violation(
        'the differ produced a diff from an input it is required to refuse. Stripping the offending field and ' +
        'diffing the remainder is the specific behaviour spec/lens-diff.md Section 4 rule 2 prohibits'
      );
    }
    return pass(`refused: ${res.reason || '(no reason given)'}`);
  }

  if (res.refused) return fail(`the differ refused a pair of conforming inputs: ${res.reason || '(no reason given)'}`);
  const diff = res.diff;
  if (!diff || !Array.isArray(diff.changes)) return fail('diff.changes is missing from the produced Lens Diff');

  const problems = [];
  if (vector.expect.schemaValid) {
    const validate = ctx.schemas.normative.LensDiff;
    if (!validate(diff)) problems.push(`does not validate against lens-diff.schema.json: ${ajvDetail(validate.errors)}`);
  }
  if (typeof vector.expect.changeCount === 'number' && diff.changes.length !== vector.expect.changeCount) {
    problems.push(
      `expected ${vector.expect.changeCount} change(s), got ${diff.changes.length}: ` +
      diff.changes.map((c) => `${c.op} ${c.path}`).join(', ')
    );
  }
  const want = vector.expect.containsChange;
  if (want) {
    const hit = diff.changes.find((c) => c.path === want.path && c.op === want.op);
    if (!hit) {
      problems.push(`no change with op "${want.op}" at path "${want.path}"`);
    } else {
      if (want.category && hit.category !== want.category) {
        problems.push(`change at "${want.path}" has category "${hit.category}", expected "${want.category}"`);
      }
      if (want.impactAtLeast && IMPACT_RANK[hit.impact] < IMPACT_RANK[want.impactAtLeast]) {
        problems.push(`change at "${want.path}" is impact "${hit.impact}", below the required minimum "${want.impactAtLeast}"`);
      }
      if (typeof hit.summary !== 'string' || hit.summary.trim() === '') {
        problems.push(`change at "${want.path}" carries no summary; summary is REQUIRED (spec/lens-diff.md Section 6.3)`);
      }
    }
  }
  return problems.length ? fail(problems.join('; ')) : pass('diff matches');
}

// ---------------------------------------------------------------------------

export const CHECKS = {
  'schema.validate': schemaValidate,
  'manifest.validate': manifestValidate,
  'anchor.resolve': anchorResolve,
  'policy.resolve': policyResolve,
  'impact.classify': impactClassify,
  'proposal.disposition': proposalDisposition,
  'interpret.result': interpretResult,
  'diff.produce': diffProduce
};

/** The adapter method each role must supply. */
export const ROLE_METHOD = {
  'manifest-consumer': 'validateManifest',
  'anchor-resolver': 'resolveAnchor',
  'lens-engine': 'interpret',
  'adaptation-engine': ['resolvePolicy', 'classifyImpact', 'disposeProposal'],
  differ: 'diff'
};
