# Lens Manifest Specification

**Status:** Draft v0.1 · **Date:** 2026-07-09 · **License:** CC-BY 4.0

This document specifies the Lens Manifest, the primary exchange object of the LensPub protocol: a portable, declarative, model-agnostic policy document expressing a user's interpretation intent. It defines the manifest's JSON structure field by field, the history-free rule governing what a manifest may never contain, identifier and hosting requirements, versioning semantics, the placement and scope of digital signatures, and the semantics of the subscriptions, privacy, and extensions blocks. The normative structural definition is [`schemas/lens-manifest.schema.json`](../schemas/lens-manifest.schema.json); this document supplies the semantics and behavioral requirements the schema cannot express.

The key words MUST, MUST NOT, REQUIRED, SHALL, SHALL NOT, SHOULD, SHOULD NOT, RECOMMENDED, NOT RECOMMENDED, MAY, and OPTIONAL in this document are to be interpreted as described in BCP 14 [RFC 2119] [RFC 8174] when, and only when, they appear in all capitals.

## 1. Introduction

A Lens Manifest is a **declarative, model-agnostic policy document** ([ADR-0001](../adr/0001-manifest-is-declarative-policy.md)). It expresses interpretation *intent* — topic priorities, source trust and distrust, presentation preferences, Domain Scopes, Adaptation Policies, privacy declarations, and subscriptions — in a structured JSON form. A [Lens Engine](lens-engine.md) compiles that intent into whatever engine-specific artifacts it needs: rules, prompts, retrieval configuration, classifier thresholds. Compiled artifacts are engine-internal and are never exchanged.

Two prohibitions follow from ADR-0001 and are protocol invariants:

1. A Lens Manifest MUST NOT contain model weights, adapters, fine-tunes, embeddings, or any other model artifact.
2. A Lens Manifest MUST NOT consist of, or contain, prompt text intended for direct execution by a model.

The rationale is portability, inspectability, and semantic diffability. Weights and prompts bind a manifest to a particular model or model family; weights do not diff usefully and prompts diff textually rather than semantically; neither is human-inspectable in the sense the constitution requires. A declarative policy document is all three: any conforming engine can consume any conforming manifest, [Lens Diffs](lens-diff.md) are field-level and semantic, and a user can read their own lens.

Manifests are serialized as JSON and exchanged with the media type `application/lens-manifest+json` (provisional; registration is addressed in the [LensPub Protocol specification](lenspub-protocol.md)). The namespace `https://lenspub.org/ns/` used in schema identifiers is provisional until the project registers its permanent home.

## 2. Conformance

Three conformance targets are distinguished:

- A **conforming Lens Manifest** is a JSON document that validates against [`schemas/lens-manifest.schema.json`](../schemas/lens-manifest.schema.json) and satisfies every normative requirement of this document, including the history-free rule of Section 3 and the referential-integrity requirements of Section 5.
- A **conforming producer** (an engine, editor, or publishing tool that emits manifests) MUST emit only conforming Lens Manifests.
- A **conforming consumer** (a Lens Engine or tool that reads manifests) MUST reject documents that fail schema validation, MUST honor the semantics defined here for every field it supports, and MUST declare unsupported features through its capability tier (see [ADR-0004](../adr/0004-reproducibility-envelope.md) and the [Architecture specification](../architecture/architecture.md)) rather than silently misapplying them.

The schema is normative for structure — field names, types, enumerations, required properties. This document is normative for behavior. Where a constraint appears in both, they are intended to agree; a discrepancy is a defect to be reported through the process in [GOVERNANCE.md](../GOVERNANCE.md).

## 3. The History-Free Rule

The Lens Manifest is the **history-free shareable core** of a lens ([ADR-0006](../adr/0006-history-free-shareable-core.md)). Adaptation State — the private, device-local record of feedback, pending Lens Change Proposals, and evaluation data — is a separate object that never travels with the manifest. The bridge between them is the proposal workflow: acceptance of a proposal is the deliberate act that distills private experience into a shareable declarative preference.

A Lens Manifest MUST NOT contain, in any field including `extensions` and free-text fields, any of the following data classes:

1. **Content identifiers of reading**: URLs, titles, canonical identifiers, or content hashes of pages, documents, or media the user has visited or read.
2. **Content excerpts**: quotations, snippets, screenshots, or machine-generated summaries of content the user has read.
3. **Reading telemetry**: timestamps of reading events, dwell times, visit frequencies, or any temporal pattern of consumption.
4. **Feedback records**: the explicit feedback events (approvals, rejections, ratings, flags) from which adaptation learns.
5. **Proposal evidence**: pending or historical Lens Change Proposals, their supporting evidence, and shadow or A/B evaluation data.
6. **Derived counters and statistics**: per-source, per-topic, or per-session aggregates accumulated from reading activity (visit counts, topic-exposure tallies, engagement metrics).
7. **Learned model state**: embeddings, caches, adapters, or any other artifact derived from content the user has read (also excluded by ADR-0001).

As a catch-all, a manifest MUST NOT contain any field from which reading history can be reconstructed, wholly or partially. This rule makes history leakage structurally impossible rather than a matter of implementer diligence: publishing, subscribing, exporting, and diffing all operate on manifest cores only, so the shared object never contained history.

Free-text fields (`description`, `rationale`, `note`) deserve specific care. Engines and tools MUST NOT machine-populate these fields with content excerpts or reading-derived text; they carry user-authored reasons only. Because a user may nevertheless type revealing text into them — and because even legitimate content (a trusted small-town newspaper) discloses interests — publication is preceded by the pre-publication disclosure review defined in the [Privacy Model](../security/privacy-model.md).

## 4. Identifiers and Hosting

### 4.1 Abstract hosting

Manifest hosting is deliberately abstract in v1. A lens identifier (`id`, Section 5.3) is either an HTTPS URL or a DID [DID-CORE]; LensPub imposes no requirement on where the bytes live. Dereferencing an HTTPS `id`, or resolving a DID whose service endpoint designates a manifest resource, SHOULD yield the current version of the manifest with media type `application/lens-manifest+json` (provisional). The `id` is stable across versions of the same lens; individual versions are distinguished by `metadata.lensVersion` and by content hash (Section 6).

`id` is OPTIONAL for purely local lenses, which need no global identity, and REQUIRED for Published Lenses, which cannot be subscribed to without one.

### 4.2 Solid hosting profile (OPTIONAL)

[Solid](https://solidproject.org/TR/protocol) is one valid hosting profile, not a dependency. A Solid-hosted lens is simply a manifest stored as a resource in the publisher's pod — for example, `https://avery.solidpod.example/lenses/avery-daily.json` — with that resource URL serving as the manifest `id`. The pod serves the document over HTTPS like any other resource; subscribers dereference it exactly as they would any HTTPS-hosted manifest, and signature verification (Section 7) is unchanged because trust derives from the proof and the publisher DID, not from the storage location.

Access control uses the pod's native mechanism: Web Access Control ([WAC](https://solidproject.org/TR/wac)) or Access Control Policy ([ACP](https://solidproject.org/TR/acp)), whichever the pod server implements. The expected configuration is public (or group-scoped) read access on the manifest resource and owner-only write access, so that anyone may subscribe while only the publisher can release new versions. Implementers should note honestly that Solid ecosystem maturity is uneven — two access-control systems coexist, server implementations vary in conformance, and pod availability is not yet mainstream — which is precisely why hosting is abstract in v1 and Solid is an OPTIONAL profile rather than a requirement.

## 5. Manifest Structure

This section walks the schema in schema order. Top-level properties: `lenspub`, `type`, `id`, `metadata`, `domains`, `interpretation`, `adaptation`, `privacy`, `subscriptions`, `versionHistory`, `proof`, `extensions`. Of these, `lenspub`, `type`, `metadata`, `interpretation`, and `adaptation` are REQUIRED. Unknown top-level properties are prohibited (`additionalProperties: false`); extensibility is confined to `extensions` (Section 5.12).

### 5.1 `lenspub` (REQUIRED)

The LensPub protocol version the manifest conforms to; fixed at the string `"0.1"` for this draft. Consumers MUST reject manifests declaring a protocol version they do not implement rather than guessing at forward compatibility.

### 5.2 `type` (REQUIRED)

The constant `"LensManifest"`. It disambiguates the document among LensPub exchange objects (`LensDiff`, `InterpretationResult`, `LensChangeProposal`) when objects are stored or transmitted together.

### 5.3 `id` (OPTIONAL)

The stable identifier of the lens: an HTTPS URL or a DID, per Section 4. REQUIRED for Published Lenses; OPTIONAL otherwise.

### 5.4 `metadata` (REQUIRED)

Descriptive and identity information. `name` and `lensVersion` are REQUIRED.

| Field | Requirement | Meaning |
|---|---|---|
| `name` | REQUIRED | Human-readable lens name, at most 200 characters. |
| `description` | OPTIONAL | Human-readable purpose statement. |
| `lensVersion` | REQUIRED | Semantic version `MAJOR.MINOR.PATCH` of this manifest (Section 6). |
| `created`, `modified` | OPTIONAL | RFC 3339 timestamps of manifest creation and last modification. These describe the *manifest document*, not reading activity, and are compatible with Section 3. |
| `publisher` | OPTIONAL | Publisher identity for Published Lenses ([ADR-0003](../adr/0003-adopt-vc2-dids-for-trust.md)): a REQUIRED `id` that MUST be a DID, an optional display `name`, and an optional `kind` drawn from `individual`, `expert`, `organization`, `partner`, `collaborative` — matching the Published Lens variants in the [Glossary](../GLOSSARY.md). |
| `lineage` | OPTIONAL | Fork provenance: `forkOf` (URI of the origin lens) and `forkOfVersion`. Lineage records where a lens *came from*, never what its user has read. |
| `language` | OPTIONAL | BCP 47 language tag for the manifest's human-readable fields. |

A Signed Manifest (Section 7) MUST include `metadata.publisher`, and the publisher's DID MUST be the controller of the verification method named in the proof.

### 5.5 `domains` (OPTIONAL)

The Domain Scopes this lens declares: an array of objects with a REQUIRED `id` (lowercase alphanumeric-and-hyphen, matching `^[a-z0-9][a-z0-9-]*$`), a REQUIRED human-readable `label`, and an optional `description`. Scope `id` values MUST be unique within a manifest.

Domain Scopes are the manifest's unit of per-domain control: priorities, adaptation overrides, privacy opt-ins, and subscription restrictions all reference them by `id`. Every such reference — in `interpretation.priorities[].domains`, `adaptation.domainPolicies[].domain`, `privacy.remoteInference.domains`, and `subscriptions[].domains` — MUST name a scope `id` declared in this array. Classifying content into scopes is an engine responsibility, and the classification MUST be explainable: an interpretation influenced by a domain-scoped rule carries the classification in its Reasoning Trace.

### 5.6 `interpretation` (REQUIRED)

The declarative interpretation policy: what to prioritize, whom to trust, and how to present overlays. The object is REQUIRED but all of its members are OPTIONAL; an empty object is valid and yields the documented defaults. This is deliberate — the floor of a useful manifest is small (see [`examples/manifests/minimalist.json`](../examples/manifests/minimalist.json)).

**`priorities`** is an array of topics or qualities to emphasize (positive `weight`) or de-emphasize (negative `weight`), each with a REQUIRED free-text `topic` and REQUIRED `weight` in [-1, 1], an optional `domains` restriction, and an optional user-authored `rationale` that engines carry into Reasoning Traces. Priorities are never a content filter: de-emphasis lowers overlay prominence, it does not hide, remove, or reorder content. This is the structural line, fixed by [ADR-0007](../adr/0007-epistemic-stance.md), between ranking *interpretations* of content the user already chose to view and ranking *content* the way a recommendation algorithm does.

**`sources`** declares source trust. `trusted` and `distrusted` are lists whose entries carry a REQUIRED `origin` — an origin URL (`https://example.com`), a registrable domain (`example.com`), or a publisher DID — plus a `weight` in [0, 1] (default 1) expressing the strength of the trust or distrust, and an optional `note`. Distrust, like negative priority, affects evidence indicators and overlay prominence; it MUST NOT cause content to be blocked or hidden. `requireProvenance` lists provenance signals the user wants surfaced when absent, from the closed set `c2pa`, `citations`, `author-identity`, `publication-date`, `corroboration`. The semantics are surfacing, not blocking: an engine annotates that a C2PA Content Credential or citation is missing; it does not gate the content on one. LensPub consumes provenance signals; it does not adjudicate truth (ADR-0007).

**`presentation`** controls which overlay classes render and how:

| Field | Type / values | Default | Meaning |
|---|---|---|---|
| `annotations` | boolean | `true` | Render Overlay Annotations. |
| `summaries` | `none` · `brief` · `detailed` | `brief` | Summary overlay verbosity. |
| `evidenceIndicators` | boolean | `true` | Render evidence indicators. |
| `counterpoints` | `off` · `on-request` · `auto` | `on-request` | When sourced counterpoints appear. |
| `primarySourceExpansion` | boolean | `true` | Offer expansion to primary sources. |
| `explanationDisplay` | `always` · `on-request` | `on-request` | Whether Reasoning Traces render inline or on demand. |

`explanationDisplay` controls display only. Reasoning Traces always exist in the Interpretation Result; a manifest cannot opt out of explainability, only out of its ambient visibility.

Every member of `presentation` governs overlay behavior on a page that is already laid out: whether an overlay class renders, and in what verbosity. None of them governs the *arrangement* of the underlying material, and that omission is deliberate. **Selection of a rendered view kind** — presenting a set of records as a table, a timeline, a source grouping, or ranked cards rather than in the arrangement the content already has — is not a member of `presentation` and MUST NOT be expressed as one. The object is closed (`additionalProperties: false`), so a manifest that invents such a member is not a conforming Lens Manifest and a conforming consumer rejects it (Section 2). A producer that supports view selection MUST carry that intent under `extensions` (Section 5.12), which is the specified home for it.

The reason is the reason [ADR-0001](../adr/0001-manifest-is-declarative-policy.md) gives for excluding prompts, one layer up. A view enum — `table`, `timeline`, `cards` — is the vocabulary of one user interface, bound to a device class and to an engine's rendering capability. A browser overlay, an e-reader, and a feed client do not have the same views available to name, and would not mean the same thing by a shared name if they did: `cards` is a lens's deliberate choice in one of them and the ambient layout in another. Every first-class manifest field denotes something an engine at any capability tier can decide it honors or declares unsupported, in a vocabulary belonging to no single implementation; that is what makes "any conforming engine can consume any conforming manifest" true rather than aspirational. A `view` field would instead be a field most engines could only ignore, whose meaning was fixed by whichever implementation's UI first spelled the enum. This is the shape of ADR-0001's objection to prompts: a prompt is portable-looking text whose meaning is set by one model family, and which diffs textually while denoting nothing the protocol can reason about. A view enum is portable-looking JSON whose meaning is set by one device class, and which the protocol can name but not interpret. Model-bound and interface-bound are the same defect at different layers, and the manifest's first-class vocabulary excludes both for the same reason.

`extensions` exists for exactly this: intent that a subset of engines understand. Its ignore-unknown rule produces the correct degradation for a view an engine cannot render — the engine consumes the manifest, honors every field it does understand, and arranges content its own way — and Section 5.12 works view selection as its motivating example, including what the placement costs.

### 5.7 `adaptation` (REQUIRED)

How readily the lens may evolve ([ADR-0010](../adr/0010-adaptation-policies-parameterized.md)). Learning is never silent: whatever the policy, changes occur only through the proposal workflow of the [Adaptation Model](adaptation-model.md), with notification and rollback unconditional.

`defaultPolicy` (REQUIRED) names the lens-wide Adaptation Policy: one of `locked`, `conservative`, `balanced`, `adaptive`, `explorer`, or `custom`. The five named policies are presets over three protocol-defined parameters, whose normative preset values live in the Adaptation Model specification:

- `proposalFrequency` — maximum Lens Change Proposals the engine may raise per week per Domain Scope; `0` means never (Locked).
- `evidenceThreshold` — minimum count of explicit feedback events supporting a change before a proposal may be raised.
- `autoAcceptCeiling` — highest proposal impact class that may be auto-accepted: `none`, `trivial`, or `minor`. The enumeration deliberately omits `major`: a major-impact change can never be auto-accepted on any conforming engine. Auto-accepted changes are always notified and always rollback-able.

`parameters` optionally overrides individual preset values; when `defaultPolicy` is `custom`, `parameters` MUST be present. `domainPolicies` lists per-domain overrides, each naming a declared Domain Scope `id` and a policy (with optional parameters). Per-domain settings take precedence over the lens-wide default; the constitution's canonical example is politics locked, technical research adaptive, entertainment explorer. Because policies are parameterized rather than named vibes, the same manifest produces the same adaptation behavior on every conforming engine — the portability users are most sensitive to.

### 5.8 `privacy` (OPTIONAL)

The declarative privacy policy ([ADR-0005](../adr/0005-local-only-default.md)). The protocol default — with or without this block — is **local-only inference**: a conforming engine performs all interpretation on-device unless the user has explicitly opted in to a remote engine.

`remoteInference.allowed` (default `false`) records that opt-in, and `remoteInference.domains` scopes it to declared Domain Scope ids. The opt-in is per-domain by construction: `allowed: true` with an empty or absent `domains` array opts in *no* scopes. Every crossing of this trust boundary is revocable at any time, and MUST be visible to the user — the Reproducibility Envelope on each Interpretation Result records whether it was produced locally or remotely (ADR-0004). Outside an active opt-in, an engine MUST NOT transmit the manifest, Adaptation State, or content excerpts to any remote service, and when a permitted remote engine is unavailable it MUST fail closed into local capability (or no interpretation), never silently substituting a different remote service.

The manifest declares *policy* only. Provider credentials, endpoints, and model choices are device-local engine configuration and MUST NOT appear in a manifest — both because they are not interpretation intent and because a shared manifest must not leak the user's provider relationships.

### 5.9 `subscriptions` (OPTIONAL)

Published Lenses this lens composes as inputs. Each entry names the subscribed lens by URL or DID (`lens`, REQUIRED) and carries three controls:

- **`trust`** — `advisory` (default) or `adopted`. An *advisory* subscription contributes signals only: the subscribed lens's judgments surface as attributed suggestions and indicators alongside the user's own, and do not alter the user's effective policy. An *adopted* subscription's declarative preferences are merged into the effective interpretation policy at application time, under the composition semantics defined in the [Lens Engine specification](lens-engine.md).
- **`pinnedVersion`** — a semantic version pin. When present, the engine applies exactly that version of the subscribed lens. When absent, the subscription tracks the latest published version, and each upstream update is surfaced to the user as a Lens Change Proposal rather than applied silently.
- **`domains`** — restricts the subscription's influence to the named Domain Scope ids declared in *this* manifest. Absent means the subscription may inform all scopes.

Precedence is absolute and non-negotiable: **the user's own settings always win.** A subscribed lens — whatever its trust level — never overrides the subscriber's priorities, source judgments, presentation choices, Adaptation Policies, or privacy declarations; conflicts resolve in the subscriber's favor, and subscription-supplied adaptation suggestions never override the user's own policy settings (ADR-0010). Subscriptions are user-initiated, inspectable, and revocable, and never require sharing browsing history (Section 3). Engines MUST verify the proof on a subscribed Signed Manifest and surface verification status (Section 7); engines at capability tiers without subscription support omit this block's behavior entirely rather than approximating it.

### 5.10 `versionHistory` (OPTIONAL)

The lineage of manifest versions: an array of entries each carrying a REQUIRED `lensVersion` and content `hash` (Section 6), an optional `date`, and the optional `proposalId` of the accepted Lens Change Proposal that produced that version. The history records versions this manifest has superseded; the entry for the current version is necessarily absent, since a document cannot contain its own hash. Version history is identifiers, hashes, and proposal references only — never reading history, never proposal evidence.

### 5.11 `proof` (OPTIONAL)

The W3C Data Integrity proof of a Signed Manifest. Placement and scope are defined in Section 7; verification mechanics in the [Security Model](../security/security-model.md).

### 5.12 `extensions` (OPTIONAL)

The manifest's single extension point. Rules:

- Consumers MUST ignore extensions they do not understand; unrecognized extension content MUST NOT cause rejection of an otherwise conforming manifest and MUST NOT alter the semantics of fields defined by this specification.
- Extension data MUST satisfy the history-free rule of Section 3, and MUST NOT smuggle in what ADR-0001 excludes (weights, executable prompt text). "It was in `extensions`" is not a conformance defense.
- Extension keys SHOULD be collision-resistant — a URI or reverse-DNS-style prefix — so independent extensions compose.
- [Lens Diff](lens-diff.md) treats extension values as opaque: they diff by equality, not structurally.

**Worked example — view selection.** The motivating case for this extension point, and the one that shows what it is and is not good for, is the selection of a rendered view kind: a lens whose author wants a set of records presented as a timeline rather than in the arrangement the content already carries. Section 5.6 excludes that choice from `interpretation.presentation`, because a view enum is one interface's vocabulary and a first-class field must be every conforming engine's. It travels here instead:

```json
"extensions": {
  "https://vendor.example/ns/view": { "kind": "timeline" }
}
```

An engine that recognizes the key MAY honor it, subject without exception to the overlay invariants of the [LensPub Protocol](lenspub-protocol.md), Sections 6.2 and 7.3: this extension point relaxes none of them, and "an extension asked for it" is no more a conformance defense than "it was in `extensions`" (second rule above). An engine that does not recognize it ignores the entry by the first rule above: the manifest is conforming, it is accepted rather than rejected, every field the engine does understand still applies, and the engine renders its own arrangement. That is the degradation this extension point exists to produce, and for a preference no two device classes can be relied on to share, it is the correct one.

**What this placement costs.** The argument against it is genuine and is not disposed of here. A reader who wants their material arranged as a timeline has expressed durable interpretation intent — on one reading, the thing a lens is most for — and three consequences follow from parking it in `extensions`:

- *It does not travel.* Another engine ignores it by rule, so the same lens presents differently in different places. That is precisely the portability the manifest otherwise guarantees, spent at the point a user is most likely to notice its absence.
- *[Lens Diff](lens-diff.md) reports the change but cannot read it.* Extension values diff by equality at the deepest common pointer, so a switch from one view to another appears as a replaced opaque value in the `extensions` category, and because a differ MUST NOT interpret extension content, the REQUIRED `summary` on that change can only report that an opaque value changed. A `presentation` edit yields "summary verbosity changed from brief to detailed"; this one yields nothing so legible, in the review screens the [Adaptation Model](adaptation-model.md) depends on.
- *The impact class rises.* The `trivial` class is defined over changes confined to `/interpretation/presentation` ([Adaptation Model](adaptation-model.md), Section 4); a change under `/extensions` falls outside it and takes the residual classification there. A view switch is therefore reviewed like a policy change rather than like a display setting.

The decision accepts those costs. For engines to agree on a first-class `view` field it would have to be a fixed enum, and fixing the enum is what fails: it would write one device class's interface vocabulary into a protocol that a browser overlay, an e-reader, and a feed client are all meant to implement, and the field would then be one most engines could only decline to honor. An extension most engines ignore is a smaller failure than a normative field most engines cannot satisfy. It is also the reversible choice: a key that independent engines converge on in the wild would be evidence that a future version could promote to a first-class field, whereas an enum standardized ahead of that evidence cannot be withdrawn from the schema once manifests depend on it. This specification has no such evidence yet.

## 6. Versioning

`metadata.lensVersion` follows [Semantic Versioning 2.0.0](https://semver.org/) with LensPub-specific bump rules tied to the proposal impact classes (trivial, minor, major) defined normatively in the [Adaptation Model](adaptation-model.md). Every accepted Lens Change Proposal — and every direct manual edit, which is classified the same way — increments the version:

| Impact class | Version bump |
|---|---|
| trivial | PATCH |
| minor | MINOR |
| major | MAJOR |

Illustratively (the normative classification is the Adaptation Model's): adjusting an existing priority weight without changing its sign is trivial; adding a priority, a trusted source, or a Domain Scope is minor; changing an Adaptation Policy, altering the `privacy` block, adding or adopting a subscription, or removing a Domain Scope is major.

Each version is an immutable, content-addressed snapshot. The content hash of a version is computed over the JCS canonicalization (Section 7) of the manifest with the `proof` property removed; SHA-256 is RECOMMENDED, encoded as hex or multibase. Published versions MUST NOT be mutated in place: any change, however small, is a new version. Rollback to any prior version MUST be supported and is itself recorded as a new version whose content equals the restored one — history moves only forward, so `versionHistory` never lies.

## 7. Signing

A Signed Manifest carries a proof under [W3C Verifiable Credential Data Integrity](https://www.w3.org/TR/vc-data-integrity/), with publisher identity expressed as a DID ([ADR-0003](../adr/0003-adopt-vc2-dids-for-trust.md)). This section fixes only what the manifest format must fix: where the proof goes and what is signed. Key discovery via DID resolution, the verification algorithm, revocation via VC status mechanisms, publisher attestation credentials, and trust-decision UX are specified in the [Security Model](../security/security-model.md).

**Where the proof goes.** The proof is the top-level `proof` property — a Data Integrity proof object (`type`, `cryptosuite`, `created`, `verificationMethod`, `proofPurpose`, `proofValue`), structured per the Data Integrity specification. The baseline cryptosuite is `eddsa-jcs-2022`, which the [Security Model](../security/security-model.md) makes REQUIRED for publishing implementations and verifiers (additional cryptosuites MAY accompany it); `proofPurpose` is `assertionMethod`.

**What is signed.** The signed payload is the manifest document with the `proof` property removed, canonicalized with the JSON Canonicalization Scheme (JCS, [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785)). Canonicalization makes the signature independent of key order and whitespace, so manifests survive reserialization by intermediate tooling. The same canonicalization underlies version hashes (Section 6), so a version's hash and its signature attest the same bytes.

Unsigned manifests remain fully valid for personal and local use. Signature requirements attach to publication and subscription: a Published Lens SHOULD be signed, engines MUST verify proofs on subscribed lenses, and verification status — verified, unverifiable, failed — MUST be surfaced to the user rather than swallowed.

## 8. Complete Example

The following manifest is the repository's running example: Avery's personal daily-driver lens (also at [`examples/manifests/avery-daily.json`](../examples/manifests/avery-daily.json), which validates against the schema).

```json
{
  "lenspub": "0.1",
  "type": "LensManifest",
  "metadata": {
    "name": "Avery's Daily Lens",
    "description": "Avery's personal daily-driver lens. Demonstrates a typical private manifest: three Domain Scopes with per-domain Adaptation Policies (politics locked, technical research adaptive, entertainment explorer), mixed positive and negative topic priorities, explicit source trust and distrust, remote inference opted in for technical research only, an advisory pinned subscription to a newsroom Organization Lens, and a version history of superseded versions. It has no id and no proof because it is not published.",
    "lensVersion": "1.4.2",
    "created": "2026-03-02T08:00:00Z",
    "modified": "2026-07-05T17:31:00Z",
    "language": "en"
  },
  "domains": [
    {
      "id": "technical-research",
      "label": "Technical research",
      "description": "Papers, benchmarks, engineering write-ups, and systems documentation."
    },
    {
      "id": "politics",
      "label": "Politics",
      "description": "Elections, legislation, and policy coverage."
    },
    {
      "id": "entertainment",
      "label": "Entertainment",
      "description": "Film, television, games, and music."
    }
  ],
  "interpretation": {
    "priorities": [
      {
        "topic": "primary sources",
        "weight": 0.9,
        "rationale": "Prefer the paper, the filing, or the dataset over commentary about it."
      },
      {
        "topic": "reproducible benchmarks",
        "weight": 0.7,
        "domains": ["technical-research"],
        "rationale": "Benchmark claims without published artifacts have misled me before."
      },
      {
        "topic": "horse-race framing",
        "weight": -0.6,
        "domains": ["politics"],
        "rationale": "Surface policy substance above polling narratives."
      },
      {
        "topic": "spoilers",
        "weight": -0.8,
        "domains": ["entertainment"],
        "rationale": "Warn me before plot details are revealed."
      },
      {
        "topic": "engagement-bait headlines",
        "weight": -0.5,
        "rationale": "De-emphasize overlays on content whose headline contradicts its body."
      }
    ],
    "sources": {
      "trusted": [
        {
          "origin": "arxiv.org",
          "weight": 0.8,
          "note": "Preprints: strong signal, still unreviewed."
        },
        {
          "origin": "https://lwn.net",
          "weight": 0.9,
          "note": "Consistently careful kernel and systems reporting."
        },
        {
          "origin": "did:web:meridianledger.example",
          "weight": 0.7,
          "note": "Newsroom whose sourcing standards I also subscribe to."
        }
      ],
      "distrusted": [
        {
          "origin": "clickcast.example",
          "weight": 0.9,
          "note": "Recycles wire copy under misleading headlines."
        }
      ],
      "requireProvenance": ["citations", "publication-date"]
    },
    "presentation": {
      "annotations": true,
      "summaries": "brief",
      "evidenceIndicators": true,
      "counterpoints": "on-request",
      "primarySourceExpansion": true,
      "explanationDisplay": "on-request"
    }
  },
  "adaptation": {
    "defaultPolicy": "balanced",
    "domainPolicies": [
      { "domain": "politics", "policy": "locked" },
      { "domain": "technical-research", "policy": "adaptive" },
      { "domain": "entertainment", "policy": "explorer" }
    ]
  },
  "privacy": {
    "remoteInference": {
      "allowed": true,
      "domains": ["technical-research"]
    }
  },
  "subscriptions": [
    {
      "lens": "https://meridianledger.example/lenspub/newsroom-standards.json",
      "pinnedVersion": "3.2.0",
      "domains": ["politics"],
      "trust": "advisory"
    }
  ],
  "versionHistory": [
    {
      "lensVersion": "1.3.0",
      "hash": "a3f1c2e8d94b7605c1a2e94f8b3d6c7a90e1f2b3c4d5e6f708192a3b4c5d6e7f",
      "date": "2026-05-14T18:22:00Z",
      "proposalId": "lcp-2026-05-14-003"
    },
    {
      "lensVersion": "1.4.0",
      "hash": "5b9e2f7c8d1a4e6f9c0b3a2d5e8f1c4b7a0d3e6f9c2b5a8d1e4f7c0b3a6d9e2f",
      "date": "2026-06-02T09:10:00Z",
      "proposalId": "lcp-2026-06-02-001"
    },
    {
      "lensVersion": "1.4.1",
      "hash": "c7d0e3f6a9b2c5d8e1f4a7b0c3d6e9f2a5b8c1d4e7f0a3b6c9d2e5f8a1b4c7d0",
      "date": "2026-06-20T21:45:00Z",
      "proposalId": "lcp-2026-06-20-002"
    }
  ]
}
```

Annotations, keyed to the sections above:

- **No `id`, no `proof`** (§5.3, §7). This lens is purely local; it needs neither a global identifier nor a signature. If Avery later published it, both would be added — and the pre-publication disclosure review (§3) would first show Avery exactly what the manifest reveals.
- **`domains`** (§5.5) declares the three scopes every other block references. Content classification into them is the engine's job, explained per-annotation in Reasoning Traces.
- **`priorities`** (§5.6) mixes lens-wide entries (primary sources, engagement bait) with domain-restricted ones. Negative weights de-emphasize overlays — the spoiler entry yields warnings, not hidden paragraphs.
- **`sources`** (§5.6) shows all three `origin` forms: registrable domain, origin URL, and publisher DID. The distrusted aggregator still renders normally; the lens surfaces its provenance record rather than blocking it.
- **`adaptation`** (§5.7) is the constitution's canonical configuration: balanced by default, politics locked (no proposals at all), technical research adaptive (trivial changes may auto-accept, notified and rollback-able), entertainment explorer.
- **`privacy`** (§5.8) opts exactly one scope into remote inference. Political and entertainment reading never crosses the trust boundary; a technical-research page may, visibly, and Avery can revoke this at any time.
- **`subscriptions`** (§5.9) pins version 3.2.0 of a newsroom Organization Lens, advisory, restricted to `politics`. Its judgments appear as attributed suggestions; if the Ledger publishes 3.3.0, Avery sees a proposal, not a silent update. Avery's own settings win any conflict.
- **`versionHistory`** (§5.10) lists the three superseded versions with hashes and proposal references — lineage without a trace of what Avery read to get here.

## 9. Security and Privacy Considerations

The manifest format's principal protections are structural: the history-free rule (Section 3) removes reading history from the exchanged object entirely; the declarative-policy rule (Section 1) keeps manifests inspectable and prevents prompt-injection payloads from riding in as "preferences"; signing (Section 7) makes tampering and impersonation of publishers detectable. Residual risks — interest inference from declared preferences, lens poisoning through subscriptions, fake Published Lenses, rollback of malicious changes — are treated in the [Security Model](../security/security-model.md), [Privacy Model](../security/privacy-model.md), and [Threat Model](../security/threat-model.md).

## 10. References

- [ADR-0001](../adr/0001-manifest-is-declarative-policy.md) — declarative, model-agnostic policy document.
- [ADR-0003](../adr/0003-adopt-vc2-dids-for-trust.md) — VC 2.0 + DIDs for identity, signing, trust.
- [ADR-0004](../adr/0004-reproducibility-envelope.md) — manifest stability vs. output reproducibility.
- [ADR-0005](../adr/0005-local-only-default.md) — local-only inference default.
- [ADR-0006](../adr/0006-history-free-shareable-core.md) — history-free shareable core.
- [ADR-0007](../adr/0007-epistemic-stance.md) — surface provenance, never adjudicate truth.
- [ADR-0010](../adr/0010-adaptation-policies-parameterized.md) — parameterized adaptation policies.
- [`schemas/lens-manifest.schema.json`](../schemas/lens-manifest.schema.json) — normative structure.
- W3C Verifiable Credentials 2.0: [Data Model](https://www.w3.org/TR/vc-data-model-2.0/), [Data Integrity](https://www.w3.org/TR/vc-data-integrity/); [DID Core](https://www.w3.org/TR/did-core/).
- [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) — JSON Canonicalization Scheme (JCS).
- [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) / [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) — BCP 14.
- [Solid Protocol](https://solidproject.org/TR/protocol), [WAC](https://solidproject.org/TR/wac), [ACP](https://solidproject.org/TR/acp) — optional hosting profile.
- [Semantic Versioning 2.0.0](https://semver.org/).
