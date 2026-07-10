# Relationship to Prior Art and Existing Standards

**Status:** Draft v0.1 · **Date:** 2026-07-09 · **License:** CC-BY 4.0

*This document is informative. It records where each major element of LensPub comes from, which standards LensPub profiles, which systems it complements, and — precisely — what it claims as new. It does not use BCP 14 normative keywords.*

## 1. Posture

A protocol proposal earns credibility as much by what it declines to invent as by what it invents. LensPub's standards posture, fixed in the [constitution](../constitution/DESIGN_HANDOFF.md), is that the protocol *profiles* existing standards wherever they exist, *complements* adjacent systems rather than competing with them, and *replaces nothing*. New specification text is written only where a careful search found no existing work to build on. Section 6 lists the four constructions for which LensPub claims novelty; everything else in this repository is a profile, a binding, or a consumer of prior work.

## 2. Standards LensPub profiles

### 2.1 W3C Web Annotation Data Model, Selectors and States

Anchoring commentary to web content that moves — single-page applications, personalization, A/B variants, edits — is a decades-old problem with substantial prior art. Robust annotation positioning was studied by Phelps and Wilensky ("Robust intra-document locations," 2000) and at Microsoft Research (Brush et al., "Robust Annotation Positioning in Digital Documents," CHI 2001), and solved in production by [Hypothesis](https://web.hypothes.is/) with its [fuzzy anchoring](https://web.hypothes.is/blog/fuzzy-anchoring/) strategy. That lineage culminated in the W3C [Web Annotation Data Model](https://www.w3.org/TR/annotation-model/), [Vocabulary](https://www.w3.org/TR/annotation-vocab/), and [Protocol](https://www.w3.org/TR/annotation-protocol/) (W3C Recommendations, 2017), with the [Selectors and States](https://www.w3.org/TR/selectors-states/) Note supplying a reusable vocabulary for pointing into documents.

LensPub takes from this work, wholesale, the annotation shape (a body attached to a target) and the anchoring vocabulary: `TextQuoteSelector`, `TextPositionSelector`, `CssSelector`, and `RangeSelector` (with `XPathSelector` also admitted by the result schema), ordered most-specific-first with graceful degradation. An [Overlay Annotation](../GLOSSARY.md) is defined as a profile of the Web Annotation Data Model, constrained from full JSON-LD to a JSON shape that plain-JSON consumers can process ([ADR-0002](../adr/0002-profile-web-annotation.md)).

LensPub adds, through the model's standard extension mechanism, the properties its use case requires and Web Annotation does not define: an interpretation `kind` (annotation, summary, evidence-indicator, counterpoint, primary-source, highlight); a mandatory Reasoning Trace on every annotation stating which manifest rule produced it; a reference to the Reproducibility Envelope of the producing run; an explicit anchor `status` (exact, degraded, unanchored, document) so that a degraded anchor is visibly marked rather than silently guessed; and a required `basis` — attributed, checkable sources — on evidence-class annotations. The normative shape is [`schemas/interpretation-result.schema.json`](../schemas/interpretation-result.schema.json).

### 2.2 W3C Verifiable Credentials 2.0, DIDs, and VC Data Integrity

Shared lenses create an identity and trust problem: who published this lens, has it been tampered with, and can trust be revoked? The W3C [Verifiable Credentials Data Model 2.0](https://www.w3.org/TR/vc-data-model-2.0/) and [Verifiable Credential Data Integrity](https://www.w3.org/TR/vc-data-integrity/) became W3C Recommendations in 2025; [Decentralized Identifiers](https://www.w3.org/TR/did-core/) (DIDs) have been a Recommendation since 2022. Together they provide decentralized identity, proof formats, attestation, and revocation (for example, [Bitstring Status List](https://www.w3.org/TR/vc-bitstring-status-list/)) without any platform dependency.

LensPub takes this stack wholesale ([ADR-0003](../adr/0003-adopt-vc2-dids-for-trust.md)): Lens Publishers are DIDs; Signed Manifests carry Data Integrity proofs; expert and organization attestations are expressed as Verifiable Credentials; revocation uses VC status mechanisms. LensPub adds no cryptography of its own — only binding rules: signatures attach to *publication and subscription* (unsigned manifests remain valid for local use), and engines are required by the Security Model to verify proofs on subscribed lenses and surface verification status to the user. DID-method choice remains open; the reference implementation uses `did:web` and `did:key`.

## 3. Systems LensPub complements

### 3.1 Solid

[Solid](https://solidproject.org/) and the [Solid Protocol](https://solidproject.org/TR/protocol) pursue a goal LensPub shares: user data stored in user-controlled pods, decoupled from applications. A Lens Manifest is exactly the kind of small, portable, user-owned document Solid was designed to host. LensPub therefore keeps manifest hosting abstract in v1 — a lens `id` is any HTTPS URL or DID — and defines Solid pods as an *optional hosting profile*, not a dependency. This reflects an honest maturity assessment: the Solid specification and ecosystem are still developing, and a young protocol should not make its viability contingent on another young protocol. Users who run pods get a natural home for their lenses; users who do not lose nothing.

### 3.2 ActivityPub, AT Protocol, and Bluesky's composable moderation

Federation and subscription are likewise problems LensPub declines to reinvent. [ActivityPub](https://www.w3.org/TR/activitypub/) (W3C Recommendation, 2018) federates social objects across the Fediverse; the [AT Protocol](https://atproto.com/) underlies Bluesky with portable identities and typed, signed records. Lens subscription is transport-agnostic in v1, with AT Protocol as the *reference binding*: its signed, schema-typed records and account portability map naturally onto distributing Signed Manifests and version updates.

The closest shipped relative of LensPub anywhere is Bluesky's [composable moderation](https://bsky.social/about/blog/4-13-2023-moderation): independent labeling services emit [labels](https://atproto.com/specs/label) on accounts and records, and users choose which labelers to subscribe to and how labels are applied. This is genuine, deployed, user-selectable interpretation infrastructure, and LensPub regards it as validation of the direction. The differences are nonetheless precise:

- **Scope of content.** Labels attach to accounts and records *within one network*. LensPub Overlay Annotations anchor to arbitrary rendered web content in the user agent — any page, any publisher, no participation required from the content's host.
- **Expressive range.** Labels are a compact vocabulary consumed mostly as hide/warn/badge decisions. LensPub's interpretation kinds span annotations, summaries, evidence indicators, sourced counterpoints, and primary-source expansion, each carrying a per-annotation reasoning trace.
- **Governance of change.** Subscribing to a labeler is a standing grant to a service whose behavior can change at any time. A LensPub subscription composes into a manifest governed by the user's own [Adaptation Policies](../adr/0010-adaptation-policies-parameterized.md): versions can be pinned, updates arrive as reviewable proposals, and differences are inspectable as Lens Diffs.
- **Execution locus.** Labelers run on their operators' infrastructure. LensPub interpretation executes local-first on the user's device by default ([ADR-0005](../adr/0005-local-only-default.md)).

The relationship is complementary rather than competitive: a labeling service could publish an Organization Lens, and AT Protocol is the reference transport for lens subscription.

### 3.3 C2PA Content Credentials

The [Coalition for Content Provenance and Authenticity](https://c2pa.org/) defines [Content Credentials](https://c2pa.org/specifications/): signed manifests recording the capture and edit history of media assets. LensPub consumes C2PA as one Provenance Signal among several — the manifest's `requireProvenance` list and the `basis` of evidence-class annotations both name `c2pa` explicitly. Consistent with [ADR-0007](../adr/0007-epistemic-stance.md), the presence or absence of Content Credentials is surfaced as a checkable fact with its basis shown, never converted into a truth verdict. LensPub adds nothing to C2PA and takes no position on its internals.

## 4. Intellectual lineage

**Middleware.** Fukuyama, Richman, Goel, and colleagues at the Stanford Cyber Policy Center proposed ["middleware"](https://cyber.fsi.stanford.edu/publication/middleware-dominant-digital-platforms) — third-party services that sit between dominant platforms and users, letting users choose their own curation — as a structural remedy for concentrated editorial power. LensPub is a middleware architecture in this sense, with two amendments: the middleware is relocated into the user agent itself (no third-party service needs to see the user's reading), and the curation policy is reified as a portable object the user owns, rather than a vendor the user selects.

**Protocols, not platforms.** Mike Masnick's ["Protocols, Not Platforms: A Technological Approach to Free Speech"](https://knightcolumbia.org/content/protocols-not-platforms-a-technological-approach-to-free-speech) (Knight First Amendment Institute, 2019) argued that moving from proprietary platforms to open protocols relocates content-moderation power to the edges. That essay shaped AT Protocol's design and shapes this one: LensPub is an attempt to specify what an *interpretation* protocol at the edge actually looks like as an exchange format rather than a product.

**Epistemic autonomy.** A philosophical literature on epistemic autonomy and cognitive liberty — for example, Matheson and Lougheed's edited volume *Epistemic Autonomy* (Routledge, 2021) and Farahany's *The Battle for Your Brain* (2023) — examines what it means to be the author of one's own belief-forming processes when those processes are increasingly mediated. LensPub takes from this literature a design goal, not a doctrine: the machinery that mediates interpretation should be owned, inspectable, and governed by the person whose cognition it mediates ([ADR-0007](../adr/0007-epistemic-stance.md) draws the operational boundary).

**Web annotation systems.** The lineage of annotation *systems* — NCSA Mosaic's group annotations (1993), Third Voice (1999–2001), Google Sidewiki (2009–2011), Genius's web annotator, Hypothesis (2011–present) — carries three hard-won lessons. Anchoring is difficult but tractable (Section 2.1). Publisher relations are a real constraint: Third Voice was attacked as "graffiti" and shut down; the [legal considerations](legal-considerations.md) document addresses why LensPub's layered-never-substituted design matters here. And centralized annotation services die with their operators — which is an argument for a portable, user-owned exchange object rather than another service.

**Local-first software.** The default that interpretation runs on-device with no network dependency follows the [local-first](https://www.inkandswitch.com/local-first/) principles articulated by Kleppmann et al. (Ink & Switch, 2019): software whose availability and privacy do not depend on someone else's server.

## 5. Comparison

| LensPub concern | What exists | What LensPub does |
|---|---|---|
| Overlay anchoring | W3C Web Annotation Data Model + Selectors and States; Hypothesis fuzzy anchoring | Profiles the model; adds interpretation kinds, mandatory reasoning traces, anchor `status` with required visible degradation (ADR-0002) |
| Identity and signing | W3C VC 2.0, DIDs, VC Data Integrity (Recommendations) | Adopts wholesale; binds signature requirements to publication and subscription (ADR-0003) |
| Hosting | Any HTTPS host; Solid pods for user-owned storage | Hosting abstract in v1 (URL or DID); Solid defined as an optional hosting profile |
| Federation / subscription | ActivityPub; AT Protocol | Transport-agnostic subscription; AT Protocol reference binding; subscriptions composed under user-owned policies |
| Provenance | C2PA Content Credentials | Consumed as one Provenance Signal; surfaced with basis, never as a verdict (ADR-0007) |
| Adaptation governance | Recommender personalization: implicit, continuous, opaque, platform-owned | Explicit parameterized policies — proposal frequency, evidence threshold, auto-accept ceiling — owned by the user (ADR-0010); *new* |
| Local-first inference | Local-first software principles; on-device and in-browser model runtimes | Local-only as the protocol default; remote inference is per-domain, revocable opt-in recorded in every result envelope (ADR-0005) |

## 6. What is actually new in LensPub

Precision here matters more than ambition. LensPub claims novelty for exactly four constructions, and nothing else:

1. **The declarative interpretation-policy object.** The Lens Manifest — a portable, model-agnostic, semantically diffable policy document expressing interpretation intent ([ADR-0001](../adr/0001-manifest-is-declarative-policy.md)). Adjacent artifacts exist — user style sheets, ad-blocker filter lists, OPML subscription lists, per-app moderation preferences — but none is a portable, engine-independent policy for *interpretation* that any conforming runtime can compile and any user can read and diff.
2. **The parameterized adaptation-governance model.** Named policies defined as points on protocol-level parameters (`proposalFrequency`, `evidenceThreshold`, `autoAcceptCeiling`), with per-domain override and a proposal-review workflow in which learning is never silent ([ADR-0010](../adr/0010-adaptation-policies-parameterized.md)). Personalization systems adapt; none known to us gives the user a portable, enforceable contract governing *how fast*.
3. **The Reproducibility Envelope.** Mandatory per-result provenance for the interpreter itself — engine, model identity and hash, parameters, prompt-template identifier, execution locality — making model drift visible rather than silent ([ADR-0004](../adr/0004-reproducibility-envelope.md)). Model cards and C2PA describe artifacts and content; the envelope instruments every individual interpretation run.
4. **The history-free sharing construction.** The structural separation of a shareable manifest core from private, device-local Adaptation State, bridged only by explicit accepted proposals — so that published lenses and Lens Diffs cannot leak reading history *by construction* rather than by policy ([ADR-0006](../adr/0006-history-free-shareable-core.md)).

Each of these fills a gap the surveyed work leaves open; none competes with a standard that already exists. Where any of them can later be replaced by an external standard of equivalent function, the standards posture in the constitution directs this project to profile that standard instead.
