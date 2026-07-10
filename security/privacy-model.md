# LensPub Privacy Model

**Status:** Draft v0.1 · **Date:** 2026-07-09 · **License:** CC-BY 4.0

This document defines the privacy architecture of LensPub: the inventory of data the protocol creates and the mobility class of each item, the local-only inference default and the mechanics and consequences of per-domain remote opt-in, the inference risks that remain after structural protections and the pre-publication disclosure review that addresses them, the constraints on organizational aggregate signals, subscription-fetch and diff privacy, and data minimization, retention, and telemetry requirements. Integrity mechanisms are specified in the companion [Security Model](./security-model.md); adversarial analysis is in the [Threat Model](./threat-model.md).

The key words MUST, MUST NOT, REQUIRED, SHALL, SHALL NOT, SHOULD, SHOULD NOT, RECOMMENDED, NOT RECOMMENDED, MAY, and OPTIONAL in this document are to be interpreted as described in BCP 14 [RFC 2119] [RFC 8174] when, and only when, they appear in all capitals.

## 1. Introduction and Scope

LensPub exists partly as a refusal: the constitution states that "the protocol must avoid creating another surveillance ecosystem" ([DESIGN_HANDOFF](../constitution/DESIGN_HANDOFF.md)). A lens observes the most sensitive behavioral stream a person produces — what they read and how they respond to it. The privacy model's job is to ensure that this stream, and everything derivable from it, stays under the user's control by *structure*, not by policy promise. Two decisions do most of the work: the history-free shareable core ([ADR-0006](../adr/0006-history-free-shareable-core.md)), which makes reading-history leakage through sharing structurally impossible rather than merely prohibited, and the local-only inference default ([ADR-0005](../adr/0005-local-only-default.md)), which keeps the reading stream on the device unless the user explicitly exports a scoped slice of it. Everything else in this document is consequences and edges.

## 2. Data Inventory and Mobility Classes

Every object the protocol defines belongs to exactly one mobility class. An implementation that moves an object outside its class does not have a privacy bug; it has a conformance violation.

| Object | Contents | Mobility class |
|---|---|---|
| Lens Manifest core | Declarative preferences and policies ([`schemas/lens-manifest.schema.json`](../schemas/lens-manifest.schema.json)) | **Shareable** — may be published, exported, subscribed to, diffed, at the user's deliberate initiative |
| Adaptation State (Lens Deltas) | Feedback records, pending Lens Change Proposals, shadow-evaluation data | **Private, local** — never published or exported; MAY sync between the user's own devices only over an end-to-end-encrypted channel |
| Interpretation Results | Overlay Annotations, Reasoning Traces, Reproducibility Envelopes, content targets ([`schemas/interpretation-result.schema.json`](../schemas/interpretation-result.schema.json)) | **Private, local** — contain content references (URL, content hash) and are therefore reading history by definition |
| Lens Diffs | Semantic comparison of two manifest cores ([`schemas/lens-diff.schema.json`](../schemas/lens-diff.schema.json)) | **Shareable** — safe by construction because inputs are cores only (Section 7) |

### 2.1 Prohibited data classes in the shareable core

Per [ADR-0006](../adr/0006-history-free-shareable-core.md) and the manifest schema, the Lens Manifest core MUST NOT contain, in any field including `extensions`:

1. URLs visited or any identifier of specific content the user has read;
2. content excerpts, quotations, or content hashes of read material;
3. timestamps of reading or interaction, or any event log;
4. feedback records or their aggregates at any granularity finer than the declarative preference they produced;
5. shadow-evaluation or A/B evaluation data;
6. any derived statistic from which items 1–5 can be reconstructed.

The bridge between the private and shareable classes is the proposal workflow: Adaptation State generates Lens Change Proposals; an accepted proposal changes only declarative fields of the core. Acceptance is the deliberate human act that distills private experience into a shareable preference — and the diff shown at acceptance is exactly the disclosure delta the user is approving. Engines MUST validate manifests against the schema before publishing or exporting; the schema's `additionalProperties: false` constraints make most violations mechanically detectable, and Section 7's refusal rule handles the rest.

## 3. Local-Only Default and Per-Domain Remote Opt-In

### 3.1 Mechanics

Per [ADR-0005](../adr/0005-local-only-default.md), a conforming Lens Engine performs all interpretation on-device unless the user has explicitly opted a Domain Scope into remote inference. The opt-in is recorded declaratively in the manifest's `privacy.remoteInference` object (`allowed`, plus the list of opted-in Domain Scope ids); provider endpoints and credentials are device-local configuration and MUST NOT appear in the manifest. The opt-in is revocable at any time, and revocation takes effect immediately for new interpretation requests. Every Interpretation Result records where it was produced: the Reproducibility Envelope's `execution.location` is `local` or `remote`, and a remote execution MUST name the authorizing `optInScope`. When the remote provider is unavailable, the engine MUST fail closed into local capability or no interpretation — never a silent substitute provider.

Domain Scope classification is an engine responsibility and MUST be explainable ([Glossary](../GLOSSARY.md), [Lens Engine specification](../spec/lens-engine.md)). This matters for privacy because misclassification can route content into an opted-in scope: an engine SHOULD classify conservatively at the remote boundary, treating uncertain content as *not* covered by the opt-in.

### 3.2 What crossing the boundary discloses, and to whom

This section is deliberately blunt, because the opt-in consent is only as good as the user's understanding of it. When a Domain Scope is opted into remote inference, the remote provider — and any infrastructure between the device and it — receives, per interpretation request:

- **content excerpts** of the page being interpreted, potentially its full rendered text, and typically its URL or title;
- **relevant Lens Manifest fragments** for that scope: the priorities, source trust and distrust weights, and presentation preferences the engine compiles into the request — that is, not just *what* the user is reading but *how the user thinks about it*;
- **request metadata**: IP address, timing, frequency, and request size — a partial reading rhythm for that scope even if content were encrypted to the provider.

Engines MUST minimize the payload: send only the manifest fragments needed for the scoped request, MUST NOT transmit Adaptation State under any circumstance, SHOULD NOT transmit the full manifest, and SHOULD strip user identifiers beyond what the provider's API demands. But minimization does not change the essential fact: **a remote provider under an active opt-in learns what the user reads in that scope and the interpretive posture they bring to it.** The protocol's contribution is that this disclosure is scoped, explicit, revocable, and visible per-result — not that it does not happen. The trust-boundary UX requirements (visible indicator before and during remote interpretation) are specified in [docs/user-experience.md](../docs/user-experience.md); the compromise case is analyzed in [Threat Model §3](./threat-model.md) and [§4.9](./threat-model.md).

## 4. Residual Inference Risk and Pre-Publication Disclosure Review

[ADR-0006](../adr/0006-history-free-shareable-core.md) makes history reconstruction from a shared core structurally impossible, but it does not make a shared core innocuous, and this document will not pretend it does. Two risks remain in full:

**A manifest is a portrait.** A trusted-source list reveals interests, communities, and likely beliefs; a distrusted-source list often reveals more. Domain Scopes named `chronic-illness-research` or `union-organizing`, priorities with user-authored rationales, per-domain policy choices (a Locked politics scope is itself informative) — all of it characterizes the person. Weights and notes written for the user's own benefit become descriptors of the user when the manifest moves.

**Publication is disclosure.** Publishing, exporting, or sharing a manifest — even to one partner — is an irreversible disclosure event. Copies cannot be recalled, and a manifest signed by the user's DID is *attributably* theirs forever ([Security Model §3](./security-model.md)).

Therefore, before any publish, export, or share action, a conforming engine MUST perform a **pre-publication disclosure review**: present a human-readable summary of everything the outgoing manifest reveals — every source in trust and distrust lists, every Domain Scope name and description, every priority topic and rationale, every subscription visible in the core, publisher identity binding, and the fact that publication is permanent and attributable — and obtain the user's explicit confirmation. The review MUST reflect the actual outgoing bytes (post-validation, post-serialization), not an approximation. Engines SHOULD offer redaction at this step (dropping rationale notes, renaming scopes, removing entries) with the effect of each redaction shown. For updates to an already-published lens, the review MAY be scoped to the diff, since the baseline is already public.

This is a consent mechanism, not a privacy mechanism, and its known weakness is stated plainly: users habituate to confirmation screens. The review is required because the alternative — silent publication of a self-portrait — is worse, not because confirmation makes the inference risk go away.

## 5. Organizational and Aggregate Signals

The constitution permits organizations to receive "only explicitly consented, aggregated, privacy-preserving signals." Normatively:

- Any organizational signal flow MUST be an explicit, revocable, per-organization opt-in, separate from and additional to any remote-inference opt-in. Absent opt-in, an organization deploying LensPub (including via an Organization Lens its members subscribe to) receives **nothing**: subscription is a pull relationship and does not create a reporting channel.
- Signals MUST be aggregates over a cohort, never per-member records, and MUST be computed from manifest-core-class data only — never from Adaptation State or Interpretation Results.
- Implementations SHOULD enforce a k-anonymity floor: no aggregate is released for a cohort smaller than k members (RECOMMENDED k ≥ 10), and the floor in force MUST be disclosed to participants. Small-cohort suppression is the minimum credible protection, not a strong one — repeated queries against shifting cohorts can still isolate individuals, and implementations SHOULD rate-limit and log aggregate queries visibly to participants.
- Differentially private release is OPTIONAL and a roadmap direction rather than a v1 requirement, consistent with the alternatives analysis of [ADR-0006](../adr/0006-history-free-shareable-core.md) (rejected for shared manifests; revisit for aggregates). Implementations that adopt it SHOULD publish their mechanism and budget parameters.

## 6. Subscription Privacy

Reading a published lens should not tell the publisher who is reading it. Fetching a Published Lens, polling it for updates, and resolving its publisher's DID SHOULD NOT identify the subscriber to the publisher or to the hosting infrastructure. Engines:

- SHOULD fetch manifests and DID documents through shared caches, relays, or CDN-style intermediaries where available — the reference AT Protocol subscription binding ([spec/lenspub-protocol.md](../spec/lenspub-protocol.md)) has this property, since subscribers read from relays rather than from the publisher's own host;
- MUST NOT send cookies, authentication, or other identifying tokens when fetching public manifests;
- SHOULD add jitter to polling schedules so that update checks do not form a per-user clock, and SHOULD reuse cached DID documents within their freshness window rather than re-resolving per fetch;
- MAY route fetches through a privacy proxy under user control.

Honest limitation: a directly hosted `did:web` publisher observes the IP address and timing of every direct fetch. For most public lenses this leaks little (subscribing to a popular expert lens is weak evidence about a person), but for narrowly targeted lenses — a small support community's shared lens — the subscriber set itself is sensitive, and SHOULD-level cache guidance is the protocol's only defense. Users for whom subscription metadata is high-stakes need network-layer protection the protocol does not provide. See [Threat Model §4.9](./threat-model.md).

## 7. Diff Privacy

Lens Diffs are shareable because their inputs are constrained, and the constraint is enforced at the tool: a conforming diff implementation MUST validate both inputs against [`schemas/lens-manifest.schema.json`](../schemas/lens-manifest.schema.json) and MUST refuse to diff documents containing fields outside the schema, rather than passing unknown fields through into `before`/`after` values. Since the manifest core is history-free by construction ([ADR-0006](../adr/0006-history-free-shareable-core.md)) and the schema rejects unknown properties, a diff over valid cores can carry only preference deltas. The `summary` strings in a diff are human-readable descriptions of manifest changes and MUST be generated from the manifest content alone, never from Adaptation State context (e.g., never "distrusted after you read three articles there" — that sentence is reading history). Note that a shared diff discloses everything a shared manifest fragment would (Section 4 applies); engines SHOULD run the pre-publication disclosure review on outbound diffs shared beyond the device.

## 8. Data Minimization and Retention

Private-local data still deserves minimization: the least dangerous record is the one that no longer exists.

- **Interpretation Results** are a cache, not an archive. Engines MUST bound the result cache and evict (age- or capacity-based); MUST provide a user-initiated purge (all results, or per-site); and SHOULD treat cached results as invalid when the target's `contentHash` no longer matches on revisit, which serves drift detection ([ADR-0004](../adr/0004-reproducibility-envelope.md)) and retention at once. Persisting results long-term as a browsable "reading record" MUST be a separate, explicit user choice, never a default.
- **Feedback records** exist to support proposals. Once the Lens Change Proposal they evidence is resolved — accepted, rejected, or expired — the records SHOULD be aged out, retaining only the accepted proposal's identifier in `versionHistory` (which contains no reading history). Engines MUST provide a full Adaptation State purge.
- **Reproducibility Envelopes** travel with their results and share their retention. One edge is worth naming: an envelope plus target passed into a bug report reveals what its user was reading and with what configuration. Engines SHOULD provide a scrubbed diagnostic export that strips `target.source`, `target.title`, content hashes, and annotation bodies while preserving the envelope fields needed to reproduce engine behavior.
- **Device-to-device sync** of Adaptation State, where offered, MUST be end-to-end encrypted with keys held only by the user's devices; the sync provider is a curious-intermediary adversary in the [Threat Model §3](./threat-model.md) and MUST NOT be able to read what it relays.

## 9. Telemetry

There is no telemetry in LensPub by default — not reduced telemetry, not anonymized telemetry, not "privacy-preserving" telemetry. A conforming Lens Engine MUST NOT collect or transmit usage analytics, interpretation statistics, crash reports, or any other operational data by default, and the protocol defines no telemetry channel for implementations to populate. Any diagnostic reporting an implementation offers MUST be off by default, opt-in per channel, content-free to the maximum extent possible (Section 8's scrubbed export), and inspectable by the user before transmission — the user sees the exact bytes, not a category description. An engine whose distribution platform injects its own analytics does not thereby gain a conformance exemption; the requirement applies to the shipped product, and implementations SHOULD disclose any platform-imposed data collection they cannot remove. This requirement is absolute because the protocol's core claim — interpretation belongs to the user — is falsified by any default reporting channel, however benign its current contents.

## 10. Relationship to Other Documents

The [Security Model](./security-model.md) defines the integrity mechanisms this document assumes (signing, verification, store integrity); note that its signing requirements interact with privacy — a signature makes a published manifest non-repudiably attributable, which is why Section 4's review names the publisher binding explicitly. The [Threat Model](./threat-model.md) analyzes the adversaries against both documents' mechanisms, including membership inference on shared lenses, remote-inference side channels, and subscription-fetch patterns (its §4.9 consolidates the privacy-leakage analysis). The privacy-relevant decisions themselves are recorded in [ADR-0005](../adr/0005-local-only-default.md) and [ADR-0006](../adr/0006-history-free-shareable-core.md); this document is their normative elaboration and does not amend them.
