# Architecture Decision Records

This directory is the frozen record of the project's constitutional decisions. Each ADR captures one decision from the design review of `constitution/DESIGN_HANDOFF.md`, accepted by the project owner on 2026-07-09. Specification documents cite these ADRs rather than re-arguing them; changing an ADR follows the amendment process in `GOVERNANCE.md`.

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-manifest-is-declarative-policy.md) | The Lens Manifest is a declarative, model-agnostic policy document | Accepted |
| [0002](0002-profile-web-annotation.md) | Overlay and anchoring profile W3C Web Annotation | Accepted |
| [0003](0003-adopt-vc2-dids-for-trust.md) | Verifiable Credentials 2.0 + DIDs for identity, signing, and trust | Accepted |
| [0004](0004-reproducibility-envelope.md) | Manifest stability guaranteed; output reproducibility via envelope | Accepted |
| [0005](0005-local-only-default.md) | Privacy default is local-only inference; cloud is explicit opt-in | Accepted |
| [0006](0006-history-free-shareable-core.md) | Adaptation state as deltas; shareable object is history-free core | Accepted |
| [0007](0007-epistemic-stance.md) | Surface provenance and rank interpretations; never adjudicate truth | Accepted |
| [0008](0008-interpretation-is-overlay-stage.md) | Interpretation is a user-agent-side, post-render overlay stage | Accepted |
| [0009](0009-licensing-and-governance.md) | CC-BY 4.0 spec, Apache-2.0 code, personal open project | Accepted |
| [0010](0010-adaptation-policies-parameterized.md) | Five adaptation policies as points on explicit parameters | Accepted |
| [0011](0011-overlay-invariants-bind-to-authored-content.md) | Overlay invariants bind to authored rendered content; a Record Set is a distinct substrate | **Proposed** |

ADRs 0001–0010 are the accepted constitutional record, decided on 2026-07-09. A **Proposed** ADR is an open proposal under [GOVERNANCE.md §3](../GOVERNANCE.md), not a decision: it binds nothing, no dependent document cites it, and it carries a minimum 14-day public review period before the maintainer rules on it.

Additional posture decisions recorded in the constitution's Standards Posture section: hosting is abstract in v1 with Solid as an optional profile; subscription transport is agnostic in v1 with AT Protocol as the reference binding.

## Format

ADRs follow the conventional format: Status, Context, Decision, Consequences, Alternatives Considered. New ADRs are numbered sequentially and never renumbered; superseded ADRs are marked as such rather than deleted.
