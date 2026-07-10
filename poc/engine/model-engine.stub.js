// SPDX-License-Identifier: Apache-2.0
//
// Model-tier engine stub — LensPub reference engine (PoC).
//
// This file is a documented interface stub, not an implementation. It marks
// the exact seam where a higher capability tier — 'local-model' (for example
// a WebLLM/WebGPU in-browser model or an on-device platform model) or
// 'hybrid' — would slot into this engine. Capability tiers are defined in the
// Lens Engine specification (../../spec/lens-engine.md); the tier declared in
// the Reproducibility Envelope tells the user which class of engine produced
// a result (ADR-0004, ../../adr/0004-reproducibility-envelope.md).
//
// Contract a model-tier implementation MUST honor:
//
//  * INPUT is the same as interpret.js: a content context
//    ({url, title, textBlocks}) plus a rule set compiled from the Lens
//    Manifest by compile.js. The manifest itself is declarative policy; any
//    prompt the model tier builds from it is a compiled, engine-internal
//    artifact and never the exchange object (ADR-0001).
//
//  * OUTPUT is an InterpretationResult conforming to
//    ../../schemas/interpretation-result.schema.json — the same schema the
//    rule-based tier emits. Model-generated annotations still require a
//    Reasoning Trace per annotation, and evidence-class kinds
//    (evidence-indicator, counterpoint, primary-source) still require a
//    `basis` of checkable, attributed facts; a model tier MUST NOT emit
//    truth verdicts (ADR-0007).
//
//  * The Reproducibility Envelope MUST change to match reality:
//    engine.capabilityTier 'local-model' (or 'hybrid'), a `model` member with
//    the model id and, where obtainable, weights hash, a `parameters` member
//    (temperature, seed, ...), and a `promptTemplate` id/hash for the
//    compiled prompt. That is what makes model drift visible (ADR-0004).
//
//  * execution.location MUST remain 'local' unless the user has granted an
//    explicit, per-Domain-Scope, revocable remote opt-in; a remote execution
//    additionally records execution.optInScope (ADR-0005,
//    ../../adr/0005-local-only-default.md). This PoC implements no remote
//    path at all: there is no fetch() to any remote host anywhere in it.
//
//  * A model tier SHOULD degrade to the rule-based pipeline (interpret.js)
//    when the model is unavailable, and MUST fail closed rather than
//    silently substituting a remote service (ADR-0005).

/**
 * Interpret content with a local model. NOT IMPLEMENTED in this PoC.
 *
 * @param {{url: string, title?: string, textBlocks: Array<object>}} context
 *   Extracted content, identical to the rule-based pipeline's input.
 * @param {object} compiledRules
 *   Rule set produced by compile.js from the active Lens Manifest.
 * @param {{model?: {id: string, hash?: string}, parameters?: object}} [options]
 *   Model selection and generation parameters, recorded verbatim in the
 *   Reproducibility Envelope.
 * @returns {Promise<object>} an InterpretationResult
 *   (../../schemas/interpretation-result.schema.json) whose envelope declares
 *   capabilityTier 'local-model' and identifies the model used.
 * @throws {Error} always, in this PoC.
 */
export async function interpretWithModel(context, compiledRules, options = {}) { // eslint-disable-line no-unused-vars
  throw new Error(
    'not implemented: this reference PoC operates at the rule-based capability tier only. ' +
    'See spec/lens-engine.md (capability tiers) for what a local-model tier must provide.'
  );
}
