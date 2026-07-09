# ADR-0005: Privacy default is local-only inference; cloud is an explicit, per-domain, revocable opt-in

**Status:** Accepted · 2026-07-09

## Context

The constitution demands local-first design and privacy by default, but also permits cloud-model engines. Sending page content plus lens preferences to a hosted model discloses both *what the user reads* and *how the user thinks about it* to a third party — precisely the surveillance dynamic LensPub exists to oppose. Local in-browser inference (WebGPU/WebLLM-class runtimes, on-device platform models) is feasible today but capability-constrained. The tension must be resolved with a hard default, not guidance.

## Decision

The privacy default is **local-only inference**. A conforming Lens Engine:

- MUST perform all interpretation on-device unless the user has explicitly opted into a remote engine;
- MUST scope cloud opt-in **per domain scope** (e.g., cloud assistance for technical research but never for health or politics), and honor it as revocable at any time;
- MUST make every trust-boundary crossing visible — the user can always tell whether a given Interpretation Result was produced locally or remotely (the Reproducibility Envelope records this);
- MUST NOT transmit the Lens Manifest, adaptation state, or content excerpts to any remote service outside an active opt-in;
- MUST fail *closed* into local capability (or no interpretation) when a remote engine is unavailable, never silently substituting a different remote service.

## Consequences

- The protocol works — at reduced richness — with zero network dependency, satisfying local-first.
- Cloud engines remain first-class for users who choose them, with the choice legible and reversible.
- Per-domain opt-in composes with per-domain adaptation policies (ADR-0010): sensitivity is managed with one mental model.
- Capability tiers absorb the experience gap between local and hosted engines (ADR-0004).

## Alternatives considered

Cloud-by-default with anonymization (rejected: anonymization of reading streams is unreliable; violates the constitution); global (not per-domain) opt-in (rejected: forces all-or-nothing choices users demonstrably fudge); forbidding cloud engines entirely (rejected: vendor neutrality cuts both ways, and some users' hardware cannot run useful local models).
