// SPDX-License-Identifier: Apache-2.0
//
// Reproducibility Envelope builder — LensPub reference engine (PoC).
//
// Every Interpretation Result MUST carry a Reproducibility Envelope so that
// engine and model drift is visible rather than silent (ADR-0004,
// ../../adr/0004-reproducibility-envelope.md). This engine runs at the
// rule-based capability tier: no model is invoked and no prompt template
// exists, so the envelope's `model` and `promptTemplate` members are
// deliberately absent (the Lens Manifest is never a prompt — ADR-0001).
// `execution.location` is always 'local': this PoC implements the local-only
// default and does not implement remote opt-in (ADR-0005,
// ../../adr/0005-local-only-default.md).
//
// Shape: ../../schemas/interpretation-result.schema.json#/$defs/reproducibilityEnvelope

export const ENGINE_ID = 'lenspub-poc';
export const ENGINE_VERSION = '0.1.0';
export const CAPABILITY_TIER = 'rule-based';

/**
 * Build the Reproducibility Envelope for one Interpretation Result.
 *
 * @param {object} [overrides] - optional shallow overrides (used by tests).
 * @returns {object} envelope conforming to the schema $defs above.
 */
export function buildEnvelope(overrides = {}) {
  return {
    engine: {
      id: ENGINE_ID,
      version: ENGINE_VERSION,
      capabilityTier: CAPABILITY_TIER
    },
    execution: {
      location: 'local'
    },
    generatedAt: new Date().toISOString(),
    ...overrides
  };
}
