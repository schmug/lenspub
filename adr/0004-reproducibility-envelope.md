# ADR-0004: Manifest stability is guaranteed; output reproducibility is best-effort via a recorded envelope

**Status:** Accepted · 2026-07-09

## Context

The constitution promises a lens that "never silently changes" and is fully versioned and diffable. This is achievable for the manifest, which is a versioned document. It is *not* achievable for interpretation output when engines use large models: models are stochastic, and hosted providers change models out-of-band. Without an explicit distinction, the promise is overclaimed and implementers will interpret it inconsistently — or worse, users will believe a guarantee the system cannot keep.

## Decision

LensPub distinguishes two guarantees:

1. **Manifest stability (guaranteed).** A Lens Manifest changes only through the adaptation proposal workflow. Every version is immutable, content-addressed, and diffable. This is a protocol invariant.
2. **Output reproducibility (best-effort, always visible).** Every Interpretation Result MUST carry a **Reproducibility Envelope** recording: engine identifier and version, model identifier and hash where obtainable, generation parameters, and prompt-template identifier. Engines SHOULD support model pinning where the runtime allows it. A change of model or engine version is a form of drift the user MUST be able to detect by inspecting envelopes over time.

Additionally, engines declare a **capability tier**, and the same manifest applied at different tiers is expected to produce different interpretation richness. Portability of the manifest is guaranteed; portability of the *experience* is explicitly not.

## Consequences

- The "never silently changes" promise becomes precise and honest: the *policy* never silently changes; the *renderer* of that policy is instrumented so its changes are never invisible.
- Envelopes give users and auditors the evidence needed to attribute a changed interpretation to model drift versus manifest change — directly serving the threat model's "model drift" entry.
- Minor cost: every result carries metadata; the schema keeps the envelope compact.

## Alternatives considered

Full determinism requirement (rejected: excludes all hosted and most local LLM engines); no reproducibility story (rejected: silently broken promise); logging outputs for replay (rejected as a protocol requirement: privacy hazard — reading history; available locally as an engine feature).
