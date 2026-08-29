// SPDX-License-Identifier: Apache-2.0
//
// Reporting. Two properties matter more than formatting: a SKIP is never
// counted, coloured, or summarised as a pass, and a conformance violation is
// distinguishable from an ordinary mismatch — the specification calls some
// wrong answers violations, and the report says which.

const AREA_TITLES = {
  manifest: 'Manifest validity and consumption',
  anchoring: 'Anchoring and degradation behaviour',
  adaptation: 'Adaptation-policy parameter enforcement',
  privacy: 'Privacy invariants'
};

const MARK = { PASS: 'PASS', FAIL: 'FAIL', SKIP: 'SKIP' };

export function renderText(results, adapter, out = console) {
  out.log(`LensPub v0.1 conformance suite`);
  out.log(`adapter: ${adapter.name} ${adapter.version} — capability tier "${adapter.capabilityTier}"`);
  out.log(`roles declared: ${adapter.roles.length ? adapter.roles.join(', ') : '(none)'}\n`);

  for (const area of ['manifest', 'anchoring', 'adaptation', 'privacy']) {
    const inArea = results.filter((r) => r.vector.area === area);
    if (!inArea.length) continue;
    out.log(`${AREA_TITLES[area]}`);
    for (const r of inArea) {
      const mark = r.violation ? 'FAIL*' : MARK[r.outcome];
      const polarity = r.vector.polarity === 'negative' ? '−' : '+';
      out.log(`  ${mark.padEnd(5)} ${polarity} ${r.vector.id}`);
      out.log(`        ${r.vector.title}`);
      if (r.outcome !== 'PASS' || r.detail) out.log(`        → ${r.detail}`);
      if (r.outcome === 'FAIL') {
        const req = r.vector.requirement;
        out.log(`        requirement: ${req.document} Section ${req.section}`);
        out.log(`        "${req.text}"`);
      }
    }
    out.log('');
  }

  // Per-requirement rollup: the answer to "which requirements did I demonstrate?"
  out.log('By requirement');
  const byReq = new Map();
  for (const r of results) {
    const key = `${r.vector.requirement.document} §${r.vector.requirement.section}`;
    const acc = byReq.get(key) || { PASS: 0, FAIL: 0, SKIP: 0 };
    acc[r.outcome] += 1;
    byReq.set(key, acc);
  }
  for (const [key, acc] of [...byReq.entries()].sort()) {
    const verdict = acc.FAIL ? 'FAIL' : acc.PASS ? (acc.SKIP ? 'PASS (partial)' : 'PASS') : 'NOT DEMONSTRATED';
    out.log(`  ${verdict.padEnd(16)} ${key}  [${acc.PASS} pass, ${acc.FAIL} fail, ${acc.SKIP} skip]`);
  }

  const tally = { PASS: 0, FAIL: 0, SKIP: 0 };
  let violations = 0;
  for (const r of results) {
    tally[r.outcome] += 1;
    if (r.violation) violations += 1;
  }
  out.log('');
  out.log(`${tally.PASS} passed, ${tally.FAIL} failed, ${tally.SKIP} skipped, of ${results.length} vectors.`);
  if (violations) out.log(`${violations} of the failures are conformance violations (marked FAIL*), not quality differences.`);
  if (tally.SKIP) out.log(`Skipped vectors are not passes. They were not run, and no conformance claim follows from them.`);
  return tally;
}

export function renderJson(results, adapter) {
  const tally = { pass: 0, fail: 0, skip: 0 };
  for (const r of results) tally[r.outcome.toLowerCase()] += 1;
  return {
    suite: 'lenspub-conformance',
    protocol: '0.1',
    adapter: { name: adapter.name, version: adapter.version, capabilityTier: adapter.capabilityTier, roles: adapter.roles },
    totals: tally,
    results: results.map((r) => ({
      id: r.vector.id,
      area: r.vector.area,
      polarity: r.vector.polarity,
      title: r.vector.title,
      requirement: r.vector.requirement,
      outcome: r.outcome,
      conformanceViolation: Boolean(r.violation),
      detail: r.detail
    }))
  };
}
