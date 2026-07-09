# ADR-0006: Adaptation state is stored as explicit deltas; the shareable object is the history-free manifest core

**Status:** Accepted · 2026-07-09

## Context

Two constitutional promises collide: lenses *learn from what the user reads* (via explicit feedback), and lenses can be *shared and diffed without exposing browsing history*. A learned artifact can encode its training inputs; naively sharing an adapted lens risks membership-inference and reconstruction of reading history. The protocol must make history leakage structurally impossible rather than relying on implementer diligence.

## Decision

LensPub separates a lens into two objects with different mobility:

1. **Manifest core (shareable).** The declarative policy document (ADR-0001). It contains preferences and policies only. It MUST NOT contain URLs visited, content excerpts, timestamps of reading, feedback records, or any field from which reading history can be reconstructed. Only manifest cores may be published, subscribed to, exported, or diffed.
2. **Adaptation state (private, local).** Feedback records, pending Lens Change Proposals, shadow-evaluation data — stored as explicit, user-reviewable deltas on the device. Adaptation state MAY sync between the user's own devices over an end-to-end-encrypted channel, but MUST NOT be included in any published or exported lens.

The bridge between them is the proposal workflow: adaptation state *generates proposals*; an accepted proposal changes only declarative fields of the core. Acceptance is the deliberate act that distills private experience into a shareable preference.

## Consequences

- Sharing and diffing are safe by construction: the shared object never contained history.
- Residual inference risk remains — a manifest that trusts `smalltownpaper.example` reveals interests. The Privacy Model addresses this with pre-publication review (a human-readable disclosure summary the user confirms before publishing).
- Lens Diff operates on manifest cores only, keeping the diff format simple and semantic.

## Alternatives considered

Differential-privacy noise on shared manifests (rejected for v1: complexity, utility cost; revisit for aggregated organizational signals); sharing full lens including learned state with consent warnings (rejected: consent does not survive the user's misunderstanding of inference risk); no learning at all (rejected: adaptation is a defining feature).
