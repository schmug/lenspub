# LensPub Protocol Specification

**Status:** Draft v0.1 · **Date:** 2026-07-09 · **License:** CC-BY 4.0

**Abstract.** LensPub is an open protocol for publishing, exchanging, and applying user-owned interpretation layers on the web. This document is the root normative specification of the protocol. It defines the LensPub object model (Lens Manifest, Interpretation Result, Lens Diff, Lens Change Proposal), the identifier and addressing scheme for lenses, provisional media types for the exchange objects, the abstract protocol operations that constitute the lens lifecycle, the conformance classes against which implementations claim conformance, and the protocol's versioning, extensibility, accessibility, internationalization, security, and privacy requirements. Detailed treatment of individual objects and behaviors is delegated to the companion specifications [Lens Manifest](./lens-manifest.md), [Lens Engine](./lens-engine.md), [Adaptation Model](./adaptation-model.md), and [Lens Diff](./lens-diff.md), which are parts of this specification.

The key words MUST, MUST NOT, REQUIRED, SHALL, SHALL NOT, SHOULD, SHOULD NOT, RECOMMENDED, NOT RECOMMENDED, MAY, and OPTIONAL in this document are to be interpreted as described in BCP 14 [RFC 2119] [RFC 8174] when, and only when, they appear in all capitals.

## 1. Introduction and Scope

Every mediated reading experience on today's web is interpreted for the user by software the user does not control. LensPub standardizes the alternative: an interpretation layer that the user owns, inspects, versions, and carries between devices and services. The design decisions underlying this specification are recorded in the project [constitution](../constitution/DESIGN_HANDOFF.md) and in ten Architecture Decision Records ([ADR-0001](../adr/0001-manifest-is-declarative-policy.md) through [ADR-0010](../adr/0010-adaptation-policies-parameterized.md)); this document transforms those decisions into normative protocol text.

Normatively, interpretation in LensPub is a user-agent-side, post-render overlay stage: it executes on the user's device or user agent, after content has been rendered, operating on the rendered document (the DOM and accessibility tree), and produces overlays layered above content without mutating it ([ADR-0008](../adr/0008-interpretation-is-overlay-stage.md)). LensPub profiles existing standards wherever they exist — the W3C Web Annotation Data Model for overlays and anchoring ([ADR-0002](../adr/0002-profile-web-annotation.md)), W3C Verifiable Credentials 2.0, Decentralized Identifiers, and VC Data Integrity for identity and signing ([ADR-0003](../adr/0003-adopt-vc2-dids-for-trust.md)) — and authors new specification only where none exists.

This specification defines:

- the object model and the JSON serialization of each exchange object (Section 3), governed by the JSON Schemas in [`../schemas/`](../schemas/);
- identifiers, addressing, and content addressing for lenses (Section 4);
- provisional media types (Section 5);
- the abstract protocol operations and the lens lifecycle (Section 6);
- conformance classes and the unconditional protocol invariants (Section 7);
- versioning and extensibility of the protocol itself (Section 8);
- accessibility and internationalization requirements (Sections 9 and 10);
- headline security and privacy invariants, with detail delegated to the [Security Model](../security/security-model.md), [Privacy Model](../security/privacy-model.md), and [Threat Model](../security/threat-model.md) (Section 11).

### 1.1 Non-Goals

LensPub is not a truth engine: it surfaces provenance and verifiable signals and never adjudicates truth ([ADR-0007](../adr/0007-epistemic-stance.md)). It is not censorship software: overlays never remove, block, or rewrite content. It is not a recommendation algorithm: a lens ranks interpretations of content the user has already chosen to view, under a policy the user owns and can read; it never selects what the user sees by opaque criteria. It is not a replacement for the web, and it is tied to no LLM vendor and no browser. LensPub standardizes user-owned interpretation; it standardizes nothing else.

## 2. Terminology

The normative vocabulary for the entire LensPub repository is defined in the [Glossary](../GLOSSARY.md), which is incorporated by reference. Terms defined there are used in this document in exactly the glossary's sense. The definitions most load-bearing for this document are restated here.

**Lens Manifest.** The primary exchange object of LensPub: a portable, declarative, model-agnostic policy document expressing a user's interpretation intent. A Lens Manifest is never model weights and never a prompt ([ADR-0001](../adr/0001-manifest-is-declarative-policy.md)), and it is history-free: it MUST NOT contain browsing history or state from which reading history can be reconstructed ([ADR-0006](../adr/0006-history-free-shareable-core.md)).

**Lens Engine.** A runtime that applies a Lens Manifest to rendered content, producing Interpretation Results. Engines may be rule-based, local-model, hosted-model, or hybrid, and declare a capability tier (Section 7.2).

**Interpretation Result.** The structured output of a Lens Engine for one content target: zero or more Overlay Annotations, each carrying a Reasoning Trace, plus a mandatory Reproducibility Envelope.

**Reproducibility Envelope.** Metadata that MUST accompany every Interpretation Result, recording engine identifier and version, execution location, model identifier and (where obtainable) hash, generation parameters, and prompt-template identifier. It makes engine and model drift visible rather than silent ([ADR-0004](../adr/0004-reproducibility-envelope.md)).

**Lens Change Proposal.** A structured, reviewable proposed modification to a Lens Manifest, generated by a Lens Engine from explicit user feedback. Adaptation is never silent: manifests change only through accepted proposals, subject to the manifest's Adaptation Policy ([ADR-0010](../adr/0010-adaptation-policies-parameterized.md)).

**Lens Diff.** A structured, semantic comparison between two Lens Manifests or two versions of one. Diffs operate on history-free manifest cores only and therefore never expose browsing history.

## 3. Object Model

LensPub defines four object types. Each is serialized as JSON [RFC 8259] and is governed by a normative JSON Schema (draft 2020-12) in [`../schemas/`](../schemas/); field-level semantics for `LensChangeProposal` are given in the [Adaptation Model](./adaptation-model.md) specification. A governing schema says nothing about whether an object may be exchanged — that is the mobility class below — and two of the four are device-local, never exchanged between parties. Where prose and schema could be read to disagree, the schema is authoritative for object structure.

Every object carries two discriminator members: `lenspub`, the protocol version (the string `"0.1"` for this draft; see Section 8), and `type`, the PascalCase object type name.

Objects have one of two mobility classes, per [ADR-0006](../adr/0006-history-free-shareable-core.md). **Shareable** objects are history-free by construction and may be published, exported, subscribed to, or transmitted. **Device-local** objects contain, or are derived from, records of what the user read; they MUST NOT be included in any published or exported lens, and MAY leave the user's device only over an end-to-end-encrypted channel between the user's own devices.

Hash values in the examples below are abbreviated for readability.

### 3.1 LensManifest

Governing schema: [`../schemas/lens-manifest.schema.json`](../schemas/lens-manifest.schema.json). Mobility class: **shareable**. Detailed field semantics: [Lens Manifest specification](./lens-manifest.md).

The Lens Manifest is the history-free shareable core of a lens. It declares metadata and versioning, Domain Scopes, the interpretation policy (topic priorities, source trust and distrust, provenance requirements, presentation preferences), the Adaptation Policy with optional per-domain overrides, the declarative privacy policy, subscriptions to Published Lenses, version history (versions, hashes, and proposal references only), an optional Data Integrity proof, and an `extensions` object (Section 8).

```json
{
  "lenspub": "0.1",
  "type": "LensManifest",
  "id": "https://avery.example/lenses/avery-daily",
  "metadata": {
    "name": "avery-daily",
    "description": "Avery's everyday reading lens.",
    "lensVersion": "1.4.0",
    "language": "en"
  },
  "domains": [
    { "id": "tech-research", "label": "Technical research" }
  ],
  "interpretation": {
    "priorities": [
      {
        "topic": "primary sources",
        "weight": 0.8,
        "rationale": "Prefer original papers over commentary."
      }
    ],
    "sources": {
      "trusted": [ { "origin": "arxiv.org", "weight": 0.9 } ]
    },
    "presentation": { "summaries": "brief", "counterpoints": "on-request" }
  },
  "adaptation": {
    "defaultPolicy": "balanced",
    "domainPolicies": [
      { "domain": "tech-research", "policy": "adaptive" }
    ]
  }
}
```

### 3.2 InterpretationResult

Governing schema: [`../schemas/interpretation-result.schema.json`](../schemas/interpretation-result.schema.json). Mobility class: **device-local**. Detailed production requirements: [Lens Engine specification](./lens-engine.md).

An Interpretation Result records what one lens version produced for one content target. It identifies the target (source URI and an optional content hash for drift detection on revisit), the exact lens version applied, the Reproducibility Envelope, and an array of Overlay Annotations. Because a result necessarily references content the user read, it is never part of a shareable lens.

An **Overlay Annotation** is a profile of the W3C Web Annotation Data Model [ANNOTATION-MODEL]: its anchor is an ordered list of W3C Selectors [SELECTORS-STATES] (most specific first) plus an anchoring `status` of `exact`, `degraded`, `unanchored`, or `document` — engines MUST NOT guess-anchor silently ([ADR-0002](../adr/0002-profile-web-annotation.md)). Every annotation carries a `kind` (`annotation`, `summary`, `evidence-indicator`, `counterpoint`, `primary-source`, or `highlight`), a body, and a REQUIRED `reasoning` trace. Evidence-class kinds (`evidence-indicator`, `counterpoint`, `primary-source`) additionally REQUIRE a `basis`: the checkable, attributed facts the annotation points to — never a truth verdict ([ADR-0007](../adr/0007-epistemic-stance.md)).

The **Reproducibility Envelope** is REQUIRED on every result. Its `execution.location` records whether interpretation ran on-device (`local`) or crossed a trust boundary (`remote`); when `remote`, the Domain Scope under which the crossing was authorized (`optInScope`) is REQUIRED ([ADR-0005](../adr/0005-local-only-default.md)).

```json
{
  "lenspub": "0.1",
  "type": "InterpretationResult",
  "target": {
    "source": "https://news.example/articles/quantum-batteries",
    "contentHash": "9b62f31f47a1c2d0"
  },
  "lens": {
    "id": "https://avery.example/lenses/avery-daily",
    "lensVersion": "1.4.0",
    "hash": "c41d9f2ab35d7e88"
  },
  "envelope": {
    "engine": {
      "id": "org.example.lens-engine",
      "version": "0.3.1",
      "capabilityTier": "local-model"
    },
    "execution": { "location": "local" },
    "model": { "id": "example-local-7b", "hash": "5d41402abc4b2a76", "pinned": true },
    "generatedAt": "2026-07-09T14:03:22Z"
  },
  "annotations": [
    {
      "kind": "evidence-indicator",
      "anchor": {
        "selectors": [
          {
            "type": "TextQuoteSelector",
            "exact": "a tenfold increase in charge density",
            "prefix": "researchers reported ",
            "suffix": " under laboratory conditions"
          }
        ],
        "status": "exact"
      },
      "body": { "value": "This claim cites a peer-reviewed study.", "format": "text/plain" },
      "basis": [
        {
          "type": "citation",
          "uri": "https://journal.example/articles/10.1234/qb-2026",
          "description": "Cited study, Journal of Energy Storage, 2026"
        }
      ],
      "reasoning": "Manifest priority 'primary sources' (weight 0.8) requests citation surfacing on quantitative claims.",
      "manifestRefs": ["/interpretation/priorities/0"]
    }
  ]
}
```

### 3.3 LensDiff

Governing schema: [`../schemas/lens-diff.schema.json`](../schemas/lens-diff.schema.json). Mobility class: **shareable**. Detailed generation and rendering requirements: [Lens Diff specification](./lens-diff.md).

A Lens Diff compares two manifest versions — the same lens over time, one user's lens against another's, a subscription update, or a proposal preview (the `comparison` member). Each change entry carries a JSON Pointer [RFC 6901] `path` into the manifest, an operation (`add`, `remove`, `replace`), a `category`, an `impact` classification (`trivial`, `minor`, `major`, per the [Adaptation Model](./adaptation-model.md)), and a REQUIRED human-readable `summary` — diffs are for people first. Because diffs operate on history-free manifest cores only, they can never expose browsing history.

```json
{
  "lenspub": "0.1",
  "type": "LensDiff",
  "from": {
    "id": "https://avery.example/lenses/avery-daily",
    "name": "avery-daily",
    "lensVersion": "1.3.2",
    "hash": "e3b0c44298fc1c14"
  },
  "to": {
    "id": "https://avery.example/lenses/avery-daily",
    "name": "avery-daily",
    "lensVersion": "1.4.0",
    "hash": "c41d9f2ab35d7e88"
  },
  "generated": "2026-07-09T09:12:00Z",
  "comparison": "self-over-time",
  "changes": [
    {
      "op": "add",
      "path": "/interpretation/sources/trusted/1",
      "after": { "origin": "ietf.org", "weight": 0.9 },
      "category": "sources",
      "impact": "minor",
      "summary": "Added ietf.org as a trusted source with weight 0.9."
    }
  ],
  "totals": { "added": 1, "removed": 0, "replaced": 0, "highestImpact": "minor" }
}
```

### 3.4 LensChangeProposal

Governing schema: [`../schemas/lens-change-proposal.schema.json`](../schemas/lens-change-proposal.schema.json). Mobility class: **device-local** (proposals are Adaptation State, [ADR-0006](../adr/0006-history-free-shareable-core.md)). Detailed field semantics: [Adaptation Model specification](./adaptation-model.md).

A Lens Change Proposal is the only mechanism by which a Lens Manifest changes under adaptation. It carries a stable identifier, the base manifest version it applies to, the proposed change as Lens Diff change objects, an aggregate summary of the explicit feedback events that motivated it, its impact classification, and optionally a shadow-evaluation offer or a reference to shadow-evaluation results. An accepted proposal produces a new manifest version whose `versionHistory` entry references the proposal's identifier. Engines present the change objects to the user as a Lens Diff with `comparison` set to `proposal-preview`; the proposal itself carries the fragment, not the rendered diff.

```json
{
  "lenspub": "0.1",
  "type": "LensChangeProposal",
  "id": "urn:uuid:9f6a2c1e-3d47-4b8a-b1e2-5c0d8e7f4a21",
  "status": "pending",
  "baseVersion": { "lensVersion": "1.4.0", "hash": "c41d9f2ab35d7e88" },
  "changes": [
    {
      "op": "replace",
      "path": "/interpretation/priorities/0/weight",
      "before": 0.8,
      "after": 0.9,
      "category": "priorities",
      "impact": "minor",
      "summary": "Raise the weight of 'primary sources' from 0.8 to 0.9."
    }
  ],
  "evidenceSummary": {
    "supportingEvents": [
      { "eventType": "approve-annotation", "count": 7 }
    ]
  },
  "impact": "minor"
}
```

## 4. Identifiers and Addressing

### 4.1 Lens Identifiers

A lens identifier (`id`) is either an HTTPS URL or a DID [DID-CORE]. The identifier is OPTIONAL for purely local lenses and REQUIRED for Published Lenses. A lens identifier MUST be stable across versions of the same lens: versions are distinguished by `metadata.lensVersion` and content hash, not by identifier.

The namespace `https://lenspub.org/ns/` used for schema `$id` values and media-type-adjacent identifiers is provisional until the project registers its permanent home.

### 4.2 Hosting

Manifest hosting is deliberately abstract in v0.1: a lens identified by an HTTPS URL MUST be dereferenceable at that URL to its current manifest serialization (Section 5); a lens identified by a DID is resolved through its DID method to a service endpoint that serves the manifest. No particular storage system is required or privileged. Solid pods [SOLID] are an OPTIONAL hosting profile: a Solid pod URL is one valid form of lens URL, and implementations MAY offer Solid-specific conveniences, but conformance never requires Solid.

### 4.3 Content Addressing

Every Lens Version is an immutable snapshot identified by the pair (semantic version, content hash). The hash is computed over the canonical manifest serialization defined in the [Lens Manifest specification](./lens-manifest.md); SHA-256 is RECOMMENDED, encoded as hex or multibase. Hashes appear in the manifest's `versionHistory`, in Lens Diff `from`/`to` references, and in the `lens` member of every Interpretation Result. A consumer that holds a hash can verify that a fetched manifest is the exact version it expects, independently of where it was hosted; content addressing, not hosting, is what makes rollback and audit trustworthy.

### 4.4 Version Identification

`metadata.lensVersion` is a semantic version [SEMVER] in `MAJOR.MINOR.PATCH` form. Every accepted Lens Change Proposal increments it. The semantic version communicates intent to humans; the content hash is authoritative for identity. Two manifests with equal hashes are the same version; two manifests with the same `lensVersion` but different hashes MUST be treated as distinct, and a Subscription Client encountering this condition MUST surface it (Section 11.1).

## 5. Media Types

LensPub defines three media types for its exchange objects. All three are **provisional pending IANA registration** [RFC 6838]; until registration completes, implementations SHOULD accept `application/json` as an alias when the `type` member identifies the object.

| Media type | Object | Governing schema |
|---|---|---|
| `application/lens-manifest+json` | `LensManifest` | [`lens-manifest.schema.json`](../schemas/lens-manifest.schema.json) |
| `application/lens-diff+json` | `LensDiff` | [`lens-diff.schema.json`](../schemas/lens-diff.schema.json) |
| `application/lens-interpretation+json` | `InterpretationResult` | [`interpretation-result.schema.json`](../schemas/interpretation-result.schema.json) |

Requirements common to all three, kept deliberately minimal:

- **Encoding.** The serialization is JSON [RFC 8259], UTF-8.
- **Required parameters.** None.
- **Optional parameters.** `lenspub` — the protocol version of the enclosed document. When present, it MUST equal the document's `lenspub` member; on mismatch the document MUST be rejected.
- **Fragment identifiers.** A fragment, when present, is interpreted as a JSON Pointer per Section 6 of [RFC 6901]. No other fragment semantics are defined.

Servers hosting Published Lenses SHOULD serve manifests with `Content-Type: application/lens-manifest+json`. `LensChangeProposal` objects are device-local and have no media type in v0.1, notwithstanding their governing schema: a media type names a serialization for exchange, and proposals are never exchanged.

## 6. Protocol Operations and Lifecycle

LensPub's operations are defined abstractly: they specify observable behavior, not APIs, wire formats, or user interfaces. A lens moves through a lifecycle of creation, application, adaptation, versioning, exchange, and comparison.

### 6.1 Create

Creating a lens produces a Lens Manifest valid against its schema, with `lensVersion` initialized (RECOMMENDED: `1.0.0` for a fresh lens, or `lineage.forkOf`/`forkOfVersion` recorded when copying an existing lens). A newly created lens is local: no identifier, publication, or signature is required.

### 6.2 Apply (Interpretation)

Application is the core runtime operation: a Lens Engine applies a Lens Manifest to a rendered content target and produces an Interpretation Result. The engine MUST honor the invariants of Section 7.3 — in particular, the result MUST carry a Reproducibility Envelope, every annotation MUST carry a reasoning trace, and the underlying content MUST NOT be rewritten, obscured by default, or reordered. Anchoring MUST follow the robust-anchoring fallback strategy of the [Lens Engine specification](./lens-engine.md): selectors are attempted most-specific-first, failures degrade gracefully, and degraded or unanchored annotations are marked as such.

### 6.3 Adapt

Adaptation is the proposal workflow: explicit user feedback accumulates as device-local Adaptation State; when the manifest's Adaptation Policy permits, the engine raises a Lens Change Proposal; the proposal is evaluated (optionally in shadow), reviewed by the user, and accepted, rejected, or modified. Engines MUST NOT modify a manifest by any other path, and MUST NOT auto-accept proposals above the policy's `autoAcceptCeiling`; even auto-accepted changes MUST be notified and rollback-able. The complete workflow, the policy parameter semantics, and the impact classification are normative in the [Adaptation Model](./adaptation-model.md) ([ADR-0010](../adr/0010-adaptation-policies-parameterized.md)).

### 6.4 Version and Rollback

Every accepted proposal (and every direct manual edit) produces a new Lens Version: `lensVersion` increments, the new content hash is computed, and a `versionHistory` entry is appended. Implementations MUST retain sufficient version information to roll back to any prior version, and rollback MUST be a first-class operation: restoring version N produces a manifest whose content hash equals version N's recorded hash.

### 6.5 Export and Import

Export serializes the manifest core — and only the manifest core — for transfer. An exporting implementation MUST NOT include Adaptation State, Interpretation Results, or any device-local object in an export. An importing implementation MUST validate the document against the manifest schema and MUST treat the imported lens as a new local lens (optionally recording `lineage`) unless the user explicitly restores it as their own.

### 6.6 Publish

Publication makes a manifest available for subscription or copying at a stable identifier (Section 4.1). A publisher MUST assign an `id`, MUST publish only the history-free core, and MUST sign the manifest: a Published Lens carries a Data Integrity proof [VC-DATA-INTEGRITY] whose issuer is the publisher's DID recorded in `metadata.publisher.id` ([ADR-0003](../adr/0003-adopt-vc2-dids-for-trust.md)). Before publication, the publishing tool MUST present the pre-publication disclosure review defined in the [Privacy Model](../security/privacy-model.md).

### 6.7 Subscribe

A subscription incorporates a Published Lens as a composable input to the user's own lens, recorded in the manifest's `subscriptions` array with an optional version pin, optional Domain Scope restriction, and a trust level (`advisory` or `adopted`; composition semantics are defined in the [Lens Engine specification](./lens-engine.md)). The user's own settings always take precedence over subscribed input.

Subscription transport is deliberately abstract in v0.1. This specification defines five abstract operations that any binding realizes; AT Protocol [ATPROTO] is the reference binding, and all bindings are informative in v0.1.

- **resolve** — map a lens identifier (HTTPS URL or DID) to a fetchable location of its current manifest.
- **fetch** — retrieve the manifest serialization from that location.
- **verify** — check the manifest's Data Integrity proof and the publisher's DID, and determine verification status. A Subscription Client MUST verify before a subscribed manifest influences interpretation, and MUST surface the verification status to the user.
- **pin** — record the subscribed version's semantic version and content hash. When `pinnedVersion` is set, the client MUST NOT apply any other version.
- **update-notify** — learn that the publisher has released a new version. Updates are never applied silently: an unpinned subscription tracks the latest version by surfacing each update to the user as a proposal, reviewed like any other Lens Change Proposal.

### 6.8 Diff

The diff operation compares two manifest versions and produces a Lens Diff (Section 3.3). Implementations MUST support at least self-over-time comparison and SHOULD support the other `comparison` kinds. Because inputs are history-free manifest cores, diffing is safe by construction ([ADR-0006](../adr/0006-history-free-shareable-core.md)); requirements on change detection and human-readable summaries are in the [Lens Diff specification](./lens-diff.md).

## 7. Conformance

### 7.1 Conformance Classes

An implementation claims conformance to one or more of the following classes. Every class is additionally bound by the unconditional requirements of Section 7.3 insofar as it handles the objects those requirements concern.

**Manifest Producer.** Software that creates or modifies Lens Manifests (an editor, an exporting engine, a publishing tool). A Manifest Producer MUST emit documents that validate against the manifest schema, MUST maintain version semantics (Section 4.4), and MUST NOT emit any field from which reading history can be reconstructed.

**Manifest Consumer.** Software that reads Lens Manifests without necessarily applying them (validators, diff tools, lens directories, review interfaces). A Manifest Consumer MUST validate incoming documents against the schema, MUST check the `lenspub` version (Section 8), and MUST ignore unrecognized `extensions` entries without failing.

**Lens Engine.** A runtime that applies manifests to content (Section 6.2) and, if it supports adaptation, implements the proposal workflow (Section 6.3). An engine is both a Manifest Consumer and — whenever it writes accepted proposals back — a Manifest Producer. Every engine MUST declare exactly one capability tier (Section 7.2), MUST accept any valid manifest without error, and MUST disclose, in a user-inspectable way, which manifest features its tier does not honor: reduced richness is conforming, silent misrepresentation is not.

**Lens Publisher.** An identity (a DID) and its tooling that publish lenses (Section 6.6). A Lens Publisher MUST sign every Published Lens, MUST publish only history-free manifest cores, MUST keep the lens identifier stable across versions, and SHOULD keep prior published versions dereferenceable to support pinning and rollback.

**Subscription Client.** Software that implements the abstract subscription operations (Section 6.7). A Subscription Client MUST implement resolve, fetch, verify, and pin, and MUST treat every subscription update as a user-reviewable proposal — automatic adoption of upstream changes is a conformance violation.

### 7.2 Lens Engine Capability Tiers

Capability tiers make the portability trade-off explicit: portability of the manifest is guaranteed; portability of the experience is not ([ADR-0004](../adr/0004-reproducibility-envelope.md)). The tiers are `rule-based`, `local-model`, `hosted-model`, and `hybrid`, as recorded in the envelope's `engine.capabilityTier` member. Detailed capability matrices are in the [Lens Engine specification](./lens-engine.md); the minimal requirements are:

- **rule-based** — MUST honor source trust and distrust weighting, presentation preferences, and provenance surfacing that is detectable without a model (e.g., presence of citations, C2PA Content Credentials); MUST implement anchoring and anchoring-status marking in full; MUST NOT fabricate model-dependent annotation kinds it cannot produce.
- **local-model** — everything rule-based, plus model-backed interpretation (summaries, priority-driven highlighting, retrieval-based counterpoints) executed entirely on-device. The envelope's `model` member is REQUIRED whenever a model is used, with weight hashes recorded where obtainable.
- **hosted-model** — everything local-model provides functionally, but via a remote engine. A hosted-model engine MUST implement the full opt-in machinery of [ADR-0005](../adr/0005-local-only-default.md): per-Domain-Scope, revocable opt-in; `execution.location` of `remote` with the authorizing `optInScope` recorded; and fail-closed behavior when the remote engine is unavailable — never silent substitution of a different remote service.
- **hybrid** — routes between local and remote execution. Each Interpretation Result MUST record where it actually executed, and routing across a trust boundary is subject to the same opt-in requirements as the hosted-model tier.

### 7.3 Unconditional Requirements

The following invariants bind every conformance class, in every tier, with no opt-out. They are the protocol's identity; an implementation that relaxes any of them is not a LensPub implementation.

1. **Never rewrite content.** Overlay Annotations are layered above content. Implementations MUST NOT rewrite, remove, reorder, or obscure-by-default the underlying content ([ADR-0008](../adr/0008-interpretation-is-overlay-stage.md)).
2. **Reasoning trace on every annotation.** Every Overlay Annotation MUST carry a `reasoning` member stating why it exists — which manifest rule, priority, source weight, or signal triggered it.
3. **Envelope on every result.** Every Interpretation Result MUST carry a Reproducibility Envelope ([ADR-0004](../adr/0004-reproducibility-envelope.md)).
4. **No silent adaptation.** A Lens Manifest changes only through the proposal workflow or direct user edit; every change is versioned, notified, and rollback-able ([ADR-0010](../adr/0010-adaptation-policies-parameterized.md)).
5. **Local-only default.** All interpretation runs on-device unless the user has an active, per-Domain-Scope, revocable remote opt-in, and every trust-boundary crossing is visible in the envelope ([ADR-0005](../adr/0005-local-only-default.md)).

## 8. Protocol Versioning and Extensibility

Every LensPub object carries a `lenspub` member naming the protocol version it conforms to; for this draft the value is the string `"0.1"`. Producers MUST set it; consumers MUST check it and MUST NOT process a document under the rules of a version other than the one it declares. A consumer encountering a version it does not implement SHOULD report the version mismatch rather than fail opaquely. During the 0.x series, any revision may make breaking changes; the schemas' `const` bindings on `lenspub` are updated in lockstep.

The object schemas are deliberately closed (`additionalProperties: false`): unknown members outside designated extension points are validation errors, which keeps interoperability failures loud and early. The single extension point in v0.1 is the Lens Manifest's `extensions` object, subject to three rules:

1. **Ignore-unknown.** Implementations MUST ignore `extensions` entries they do not understand, and a manifest MUST remain correct — if less rich — when all of its extensions are ignored. Extensions MUST NOT alter the meaning of core manifest fields.
2. **Namespacing.** Extension keys SHOULD be collision-resistant (reverse-DNS names or URIs are RECOMMENDED).
3. **No history data.** Extensions MUST NOT carry browsing history, content excerpts, feedback records, or any other history-derived data. The history-free property of the manifest ([ADR-0006](../adr/0006-history-free-shareable-core.md)) applies to the whole document, extensions included.

`InterpretationResult` and `LensDiff` define no extension point in v0.1; extension of those objects requires a protocol revision.

## 9. Accessibility Requirements

Interpretation operates on the rendered document, including its accessibility tree, and its output must serve assistive-technology (AT) users as fully as sighted mouse users. Rendering-level detail is specified in the [Lens Engine specification](./lens-engine.md); the protocol-level requirements are:

- Overlays MUST NOT break the accessibility tree of the underlying content: rendering an Interpretation Result MUST NOT remove, re-parent, or re-order the content's existing accessibility nodes, and overlay nodes MUST be additive.
- Every rendered Overlay Annotation MUST be reachable by assistive technology: programmatically exposed with an appropriate role and accessible name, focusable, and operable by keyboard alone.
- The anchoring status of Section 3.2 MUST be conveyed non-visually as well as visually: a `degraded` or `unanchored` annotation whose status is indicated only by color, position, or other purely visual styling does not conform.
- Overlays MUST NOT obscure content by default (Section 7.3, invariant 1); this requirement applies equally to visual occlusion and to accessibility-tree occlusion (e.g., `aria-hidden` on content nodes).

## 10. Internationalization

Human-readable manifest fields (names, descriptions, labels, rationales, notes) are tagged by `metadata.language`, a BCP 47 [BCP47] language tag; Manifest Producers SHOULD set it. A single manifest carries one language tag in v0.1; multilingual manifests are an extensibility candidate.

Overlay Annotations inherit content language where possible: an engine SHOULD produce annotation bodies in the language of the interpreted content and MAY fall back to the user's preferred language when it cannot. The serialized annotation body carries no language tag in v0.1; renderers SHOULD mark the language of rendered overlay text (for example, with an HTML `lang` attribute) whenever it differs from the surrounding content, for correct pronunciation by assistive technology. Lens Diff `summary` strings are addressed to the reviewing person; the [Lens Diff specification](./lens-diff.md) recommends producing them in the language declared by the `to` manifest's `metadata.language`. Text anchoring MUST NOT assume any particular script, writing direction, or whitespace-based word segmentation.

## 11. Security and Privacy Considerations

### 11.1 Security

The [Security Model](../security/security-model.md) and [Threat Model](../security/threat-model.md) are the normative references for verification requirements, key management, revocation, and the analysis of lens poisoning, fake public lenses, prompt injection, adversarial optimization, and model drift. The headline invariants are stated here. Publisher identity and manifest integrity rest on W3C Verifiable Credentials 2.0 [VC-DATA-MODEL], DIDs [DID-CORE], and Data Integrity proofs [VC-DATA-INTEGRITY]; engines MUST verify proofs on subscribed lenses and MUST surface verification status to the user. A version/hash mismatch (Section 4.4) or a failed proof MUST prevent the subscribed manifest from influencing interpretation until the user explicitly decides otherwise. Manifests are data, never code: no manifest field is ever evaluated or executed, and manifest content — like page content — MUST be treated as untrusted input to any model an engine invokes. Rollback (Section 6.4) is a security control: it is the guaranteed recovery path from an accepted-then-regretted proposal or a poisoned subscription update.

### 11.2 Privacy

The [Privacy Model](../security/privacy-model.md) is the normative reference; the headline invariants are stated here. The privacy default is local-only inference, with remote inference an explicit, per-Domain-Scope, revocable opt-in whose every use is recorded in the Reproducibility Envelope ([ADR-0005](../adr/0005-local-only-default.md)). The shareable objects are history-free by construction ([ADR-0006](../adr/0006-history-free-shareable-core.md)): manifests and diffs never contain reading history, and device-local objects never travel except end-to-end encrypted between the user's own devices. Implementations MUST NOT transmit lens contents, Adaptation State, or interpretation telemetry to any party absent explicit user action. Residual inference risk — a manifest's trusted sources reveal interests — is addressed by the pre-publication disclosure review (Section 6.6). LensPub must not become the surveillance ecosystem it exists to oppose.

## 12. References

### 12.1 Normative

- [RFC 2119] Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", <https://www.rfc-editor.org/rfc/rfc2119>
- [RFC 8174] Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", <https://www.rfc-editor.org/rfc/rfc8174>
- [RFC 8259] Bray, T., "The JavaScript Object Notation (JSON) Data Interchange Format", <https://www.rfc-editor.org/rfc/rfc8259>
- [RFC 6901] Bryan, P., Zyp, K., Nottingham, M., "JavaScript Object Notation (JSON) Pointer", <https://www.rfc-editor.org/rfc/rfc6901>
- [RFC 6838] Freed, N., Klensin, J., Hansen, T., "Media Type Specifications and Registration Procedures", <https://www.rfc-editor.org/rfc/rfc6838>
- [BCP47] Phillips, A., Davis, M., "Tags for Identifying Languages", <https://www.rfc-editor.org/rfc/rfc5646>
- [ANNOTATION-MODEL] W3C, "Web Annotation Data Model", <https://www.w3.org/TR/annotation-model/>
- [SELECTORS-STATES] W3C, "Selectors and States", <https://www.w3.org/TR/selectors-states/>
- [VC-DATA-MODEL] W3C, "Verifiable Credentials Data Model v2.0", <https://www.w3.org/TR/vc-data-model-2.0/>
- [VC-DATA-INTEGRITY] W3C, "Verifiable Credential Data Integrity 1.0", <https://www.w3.org/TR/vc-data-integrity/>
- [DID-CORE] W3C, "Decentralized Identifiers (DIDs) v1.0", <https://www.w3.org/TR/did-core/>
- [JSON-SCHEMA] "JSON Schema: A Media Type for Describing JSON Documents", draft 2020-12, <https://json-schema.org/specification>
- [SEMVER] Preston-Werner, T., "Semantic Versioning 2.0.0", <https://semver.org/spec/v2.0.0.html>

### 12.2 Informative

- [SOLID] "Solid Protocol", <https://solidproject.org/TR/protocol>
- [ATPROTO] "AT Protocol Specifications", <https://atproto.com/specs/atp>
- [ACTIVITYPUB] W3C, "ActivityPub", <https://www.w3.org/TR/activitypub/>
- [C2PA] Coalition for Content Provenance and Authenticity, "C2PA Specifications", <https://c2pa.org/specifications/>
