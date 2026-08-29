// SPDX-License-Identifier: Apache-2.0
//
// A conformance adapter template. Copy it next to your engine, fill in the
// methods for the roles you actually implement, and run:
//
//   npm run conformance -- --adapter ./path/to/your-adapter.mjs
//
// As shipped it declares no roles, so every vector reports SKIPPED. That is the
// suite's baseline behaviour and worth seeing once: an implementation is
// credited only with what it demonstrates, and an empty adapter demonstrates
// nothing. Add a role to `roles` only when the method beside it really works —
// declaring a role you have not implemented is a load-time error, not a skip.
//
// The full contract, including the shape of every argument and return value,
// is in conformance/ADAPTER.md.

export default {
  name: 'example',
  version: '0.0.0',

  // One of: 'rule-based', 'local-model', 'hosted-model', 'hybrid'.
  // Vectors scoped to other tiers are skipped rather than failed.
  capabilityTier: 'rule-based',

  // Declare only what you implement. Known roles:
  //   'manifest-consumer'  -> validateManifest()
  //   'anchor-resolver'    -> resolveAnchor()
  //   'lens-engine'        -> interpret()
  //   'adaptation-engine'  -> resolvePolicy(), classifyImpact(), disposeProposal()
  //   'differ'             -> diff()
  roles: [],

  // --- manifest-consumer ---------------------------------------------------
  // validateManifest(document) -> { accepted: boolean, errors?: string[] }
  //
  // validateManifest(document) {
  //   const errors = myEngine.checkManifest(document);
  //   return { accepted: errors.length === 0, errors };
  // },

  // --- anchor-resolver -----------------------------------------------------
  // resolveAnchor({ content, selector }) -> { status, start, end }
  //
  // `content` is a flat text run with no element structure, so the ladder's
  // nearest-stable-ancestor step does not apply here: an engine that cannot
  // locate the quote reports 'unanchored', never a guessed 'exact'.
  //
  // resolveAnchor({ content, selector }) {
  //   return myEngine.locate(content, selector);
  // },

  // --- lens-engine ---------------------------------------------------------
  // interpret({ manifest, content }) -> InterpretationResult
  //
  // `content` is { source, title?, blocks: [{ text, tag?, linkCount? }] } —
  // already-extracted rendered text, so the suite needs no DOM.
  //
  // interpret({ manifest, content }) {
  //   return myEngine.interpret(manifest, content);
  // },

  // --- adaptation-engine ---------------------------------------------------
  // resolvePolicy({ manifest, domains }) ->
  //   { proposalFrequency, evidenceThreshold, autoAcceptCeiling,
  //     exploratoryProposalsPermitted }
  // classifyImpact({ change })       -> 'trivial' | 'minor' | 'major'
  // disposeProposal({ policy, proposal })
  //   -> { disposition: 'auto-accept' | 'require-review' | 'must-not-raise' }

  // --- differ --------------------------------------------------------------
  // diff({ from, to }) -> { refused: boolean, reason?: string, diff?: LensDiff }
  //
  // Refusing is a first-class outcome: an input carrying a field the manifest
  // schema does not define must produce no diff at all.
};
