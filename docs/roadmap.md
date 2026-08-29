# Roadmap

**Status:** Draft v0.1 · **Date:** 2026-07-09 · **License:** CC-BY 4.0

*This document is informative. It lays out the intended phases of LensPub's development, with explicit exit criteria for each phase, and closes with the open problems the project does not yet know how to solve. The roadmap is honest by design: LensPub is a personal open project ([ADR-0009](../adr/0009-licensing-and-governance.md)), phase boundaries are goals rather than commitments, and later phases exist only if earlier ones earn them.*

## Phase 0 — Specification draft and browser proof of concept (this repository)

Phase 0 is the current phase: transform the [design constitution](../constitution/DESIGN_HANDOFF.md) into a complete, internally consistent v0.1 specification, and demonstrate that the protocol is implementable with a browser-extension proof of concept ([`poc/`](../poc/), Apache-2.0). The deliverables are the documents, schemas, and examples in this repository: the protocol, manifest, engine, adaptation, and diff specifications; the security, privacy, and threat models; the three JSON Schemas; and one complete end-to-end [worked example](../examples/worked-example/) — a page, a manifest, the resulting overlay, and the engine's reasoning trace.

**Exit criteria.** The repository is internally consistent (prose matches schemas; every cross-reference resolves; every JSON example validates). The proof of concept applies a Lens Manifest to live pages end-to-end: anchoring with visible degradation, reasoning traces on every Overlay Annotation, a Reproducibility Envelope on every Interpretation Result, and the proposal-review workflow for at least one adaptation cycle. An engineer who has never spoken to the author can read the repository and begin an implementation — the constitution's stated success criterion.

## Phase 1 — Review, conformance, and a second implementation

A specification nobody has criticized is a draft, whatever its version number says. Phase 1 opens a public review cycle: issues and pull requests against the spec, tracked and dispositioned per [GOVERNANCE.md](../GOVERNANCE.md), with substantive resolutions recorded. Alongside review, Phase 1 closes the known specification gaps — the first of them, a published JSON Schema for the Lens Change Proposal object, now ships as [`../schemas/lens-change-proposal.schema.json`](../schemas/lens-change-proposal.schema.json) — and builds a conformance test suite: manifest validity vectors, anchoring-degradation behavior, adaptation-policy parameter enforcement (including the auto-accept ceiling as a conformance violation boundary), and privacy invariants such as local-only default and history-free manifests.

The phase's defining goal is a **second, independent implementation** — an engine written by someone other than the originator, ideally at a different capability tier (a rule-based engine would be a particularly valuable test of model-agnosticism). Independent implementation is the only credible test that the specification, rather than the author's intentions, defines the protocol.

**Exit criteria.** A v0.2 draft incorporating review dispositions; the Lens Change Proposal schema published and exercised by examples; a conformance suite that the reference implementation passes; and at least one external implementer engaged, with a second implementation passing the manifest-consumption and anchoring portions of the suite.

## Phase 2 — Sharing infrastructure

Phase 2 makes the sharing story concrete. Three work items, in priority order. First, the **subscription reference binding on AT Protocol**: lexicon definitions for publishing Signed Manifests and version updates as typed records, so that lens subscription and update-as-proposal flow over existing federated infrastructure. Second, the **Solid hosting profile implementation**: demonstrating a Lens Manifest stored in and served from a user's pod, satisfying the optional hosting profile the specification defines. Third, **registry and discovery conventions for signed lenses**: how a user finds Expert and Organization Lenses worth subscribing to — publication conventions, verification-status display, and curation formats — specified deliberately as conventions rather than as a central registry (see the open problems below).

**Exit criteria.** A cross-implementation demonstration in which a lens published by one engine is discovered, verified (Data Integrity proof and publisher DID), subscribed to, and composed by a different engine, with a subscription update arriving as a reviewable Lens Change Proposal. Manifest hosting demonstrated on at least two profiles (plain HTTPS and Solid pod). Discovery documented without introducing any component whose failure or capture would centralize the ecosystem.

## Phase 3 — Beyond the browser, and beyond the originator

Phase 3 generalizes and, if warranted, hands off. The interpretation stage is defined over any user agent exposing a rendered-content tree ([ADR-0008](../adr/0008-interpretation-is-overlay-stage.md)); Phase 3 targets at least one **non-browser embodiment** — an e-reader, a feed client, or an OS-level agent. It specifies **aggregated organizational signals with differential privacy**, the deferred alternative noted in [ADR-0006](../adr/0006-history-free-shareable-core.md), so organizations can learn from consenting members' lenses without any individual's manifest or history being exposed. It completes **media-type and namespace registration**: IANA registration of `application/lens-manifest+json` and `application/lens-diff+json`, and replacement of the provisional `https://lenspub.org/ns/` namespace with a permanent home. And it confronts stewardship: per [ADR-0009](../adr/0009-licensing-and-governance.md), if adoption warrants, the project migrates to **neutral stewardship** — a community group or foundation — a move the CC-BY 4.0 / Apache-2.0 licensing was chosen to survive without relicensing.

**Exit criteria.** One non-browser embodiment interpreting real content under an unmodified Lens Manifest; a reviewed differential-privacy aggregation specification with a reference implementation; media types registered and the permanent namespace live; and a written stewardship decision — either a completed migration or a reasoned, public decision to remain a personal open project for another phase.

## Open problems

Honesty requires naming what is unsolved, not only what is planned.

**Anchoring on hostile or aggressively dynamic pages.** Selector-based anchoring with visible degradation handles ordinary drift, but pages that actively randomize their DOM, render entirely to canvas, or A/B-test at the sentence level can defeat it. A site that *wants* to break overlays probably can. The protocol's answer today is graceful, visible failure — not success.

**Domain classification quality.** Per-domain policies ([ADR-0010](../adr/0010-adaptation-policies-parameterized.md)) and per-domain cloud opt-in ([ADR-0005](../adr/0005-local-only-default.md)) both depend on the engine classifying content into Domain Scopes correctly and explainably. Misclassification is not cosmetic: routing a health page to a scope with cloud inference enabled is a privacy failure. Classification quality on local-capable models is an open empirical question.

**The local-model capability floor.** The privacy default is local-only inference, but the interpretation quality achievable entirely on-device varies enormously across hardware and is, on low-end devices, thin. If the local experience is too weak, users will opt into the cloud, eroding the default in practice. The protocol's capability tiers make this gap visible; they do not close it.

**Discovery without centralization.** Any convenient lens directory tends toward becoming the gatekeeper the project exists to avoid — a registry that ranks lenses is a recommendation algorithm one layer up. Phase 2's conventions-not-registry stance is a position, not yet a proven design.

**Funding sustainability.** A personal open project with no monetization path must be honest that specification maintenance, conformance-suite upkeep, and stewardship transitions all cost sustained effort. Grants, patronage, and institutional adoption are the plausible routes; none is secured, and the roadmap's later phases depend on one of them materializing.
