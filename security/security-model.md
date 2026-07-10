# LensPub Security Model

**Status:** Draft v0.1 · **Date:** 2026-07-09 · **License:** CC-BY 4.0

This document defines the positive security architecture of LensPub: the trust model among the protocol's principals, the signing mechanics and verification requirements for Signed Manifests, the key lifecycle and compromise-recovery obligations of Lens Publishers, rollback protection for subscribed lenses, integrity requirements for the local lens store, and the supply-chain and update posture of Lens Engines. It states what conforming implementations MUST do to keep the protocol's promises; the adversarial analysis of how those requirements can fail lives in the companion [Threat Model](./threat-model.md), and the confidentiality of data flows is specified in the [Privacy Model](./privacy-model.md).

The key words MUST, MUST NOT, REQUIRED, SHALL, SHALL NOT, SHOULD, SHOULD NOT, RECOMMENDED, NOT RECOMMENDED, MAY, and OPTIONAL in this document are to be interpreted as described in BCP 14 [RFC 2119] [RFC 8174] when, and only when, they appear in all capitals.

## 1. Introduction and Scope

LensPub's security goals follow directly from its constitution ([DESIGN_HANDOFF](../constitution/DESIGN_HANDOFF.md)): the user owns the lens, the lens never silently changes, and sharing a lens must not become a channel for tampering, impersonation, or surveillance. This document specifies the mechanisms that uphold the first two goals and the integrity half of the third: identity, signing, verification, versioning, rollback protection, store integrity, and update discipline. Terminology is used exactly as defined in the [Glossary](../GLOSSARY.md).

Two boundaries scope this document. First, LensPub profiles existing standards rather than inventing cryptography: identity, signing, and revocation are an application of [W3C Verifiable Credentials 2.0](https://www.w3.org/TR/vc-data-model-2.0/), [Decentralized Identifiers](https://www.w3.org/TR/did-core/), and [VC Data Integrity](https://www.w3.org/TR/vc-data-integrity/), per [ADR-0003](../adr/0003-adopt-vc2-dids-for-trust.md). Where this document appears to restate those specifications, the W3C text is authoritative and this document is a profile of it. Second, this document specifies protocol-level security. Host-platform security — operating system hardening, browser sandboxing, disk encryption — is assumed, not provided; Section 7 states this assumption explicitly rather than papering over it.

## 2. Trust Model and Principals

LensPub has one trust root: the user. Every other principal holds only the authority the user has explicitly and revocably granted it. The table below summarizes the principals; the prose that follows is normative.

| Principal | Trust level | Basis of trust |
|---|---|---|
| User | Trust root | N/A — all authority derives from explicit user action |
| Lens Engine | Fully trusted, constrained | Necessity; constrained by conformance requirements and supply-chain posture (Section 8) |
| Lens Publisher | Scoped, granted, revocable | DID identity + Data Integrity proof + explicit Subscription at a user-chosen trust level |
| Subscription source (hosting/transport) | Untrusted for integrity; untrusted for privacy | Signatures make hosting irrelevant to integrity; see [Privacy Model §6](./privacy-model.md) for the privacy consequence |
| Content origin | Untrusted, presumed adversarial | None; content is input to interpretation, never instruction (Section 2.4) |
| Remote inference provider (OPTIONAL) | Untrusted by default; conditionally trusted within an explicit per-domain opt-in | [ADR-0005](../adr/0005-local-only-default.md); disclosure consequences in [Privacy Model §3](./privacy-model.md) |

### 2.1 The user

The user is the sole trust root. No principal — engine, publisher, subscription, provider — may acquire authority over the user's Lens Manifest except through an action the user takes knowingly: accepting a Lens Change Proposal, adding a Subscription, granting a per-domain remote-inference opt-in. Every such grant MUST be revocable, and revocation MUST NOT require the cooperation of the party losing trust.

### 2.2 The Lens Engine

The Lens Engine is fully trusted by necessity: it reads the content the user reads, holds the Lens Manifest and the private Adaptation State, and produces every Interpretation Result. There is no cryptographic mechanism by which a user can use an engine while distrusting it. The protocol therefore constrains the engine in two other ways: conformance requirements that make its behavior legible (Reasoning Traces, Reproducibility Envelopes, the proposal workflow — see the [Lens Engine specification](../spec/lens-engine.md) and [ADR-0004](../adr/0004-reproducibility-envelope.md)), and supply-chain requirements that make the code the user runs auditable and non-mutable at runtime (Section 8). An engine that a user cannot inspect or that changes itself silently fails conformance regardless of its interpretation quality.

### 2.3 Lens Publishers and subscription sources

A Lens Publisher is a DID. Trust in a publisher is never ambient: it is created when the user subscribes, scoped by the subscription's `trust` field (`advisory` or `adopted`) and optional Domain Scope restriction, and destroyed when the user unsubscribes. The publisher is trusted for the content of its Published Lens only — never for the user's own settings, which always take precedence (see the [Lens Manifest specification](../spec/lens-manifest.md) and [ADR-0010](../adr/0010-adaptation-policies-parameterized.md)).

The subscription source — whatever server, pod, relay, or federation transport delivers the manifest bytes — is untrusted for integrity. All integrity guarantees ride on the Data Integrity proof (Section 3), so a hostile or compromised host can at worst withhold updates or serve stale ones (Section 6 and [Threat Model §4.7](./threat-model.md)). The source is also a privacy observer; that problem and its mitigations belong to the [Privacy Model](./privacy-model.md).

### 2.4 Content origins

Content origins are presumed adversarial. The single most important rule in LensPub's runtime security model, stated normatively in the [Lens Engine specification](../spec/lens-engine.md), is: **content is data, never commands.** Nothing an origin serves — text, markup, metadata, invisible spans — may alter engine behavior, manifest state, trust decisions, or opt-in scope. Content can only be *interpreted*. The prompt-injection consequences of engines that use large language models are analyzed in [Threat Model §4.1](./threat-model.md).

### 2.5 Remote inference providers

A remote inference provider is untrusted by default and does not exist in the default configuration: [ADR-0005](../adr/0005-local-only-default.md) makes local-only inference the privacy default. Within an explicit, per-domain, revocable opt-in, the provider is trusted to perform inference — and necessarily sees what it is sent. It is never trusted with authority: its outputs are Interpretation Results like any other, subject to the same Reasoning Trace and Reproducibility Envelope requirements, and can influence the manifest only through the ordinary proposal workflow. An engine MUST fail closed into local capability when the provider is unavailable and MUST NOT substitute a different remote service silently.

## 3. Signed Manifests

A Signed Manifest is a Lens Manifest carrying a proof under [W3C VC Data Integrity](https://www.w3.org/TR/vc-data-integrity/) in its `proof` member, with the issuer identified by a DID ([ADR-0003](../adr/0003-adopt-vc2-dids-for-trust.md)). Signing attaches to *publication and subscription*: unsigned manifests remain fully valid for personal and local use, and a purely local lens gains nothing from a signature.

### 3.1 What is signed

The signing input is the Lens Manifest serialized as JSON per [`schemas/lens-manifest.schema.json`](../schemas/lens-manifest.schema.json), canonicalized with the JSON Canonicalization Scheme (JCS, [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785)), **with the `proof` member removed**. Concretely, for the REQUIRED cryptosuite (Section 3.3), the signed data is constructed as defined by [`eddsa-jcs-2022`](https://www.w3.org/TR/vc-di-eddsa/): the SHA-256 hash of the JCS canonicalization of the proof configuration (the proof object without `proofValue`), concatenated with the SHA-256 hash of the JCS canonicalization of the manifest document without `proof`, signed with Ed25519. Every byte of the manifest core is therefore covered — including `versionHistory`, `metadata.lensVersion`, and `subscriptions` — which is what makes the rollback protection of Section 6 and the diff integrity of the [Lens Diff specification](../spec/lens-diff.md) meaningful.

JCS-based suites are chosen deliberately: Lens Manifests are plain JSON, not JSON-LD, and JCS canonicalization requires no RDF processing, no `@context` resolution, and therefore no network access during verification. Verification MUST be possible fully offline given a cached DID document.

### 3.2 Proof structure

The `proof` member is a Data Integrity proof object (or a set of them, per the proof-set mechanism of VC Data Integrity). Each proof contains at minimum:

| Field | Requirement |
|---|---|
| `type` | MUST be `"DataIntegrityProof"` |
| `cryptosuite` | Cryptosuite identifier, e.g. `"eddsa-jcs-2022"` |
| `created` | Timestamp of proof creation (`dateTime`) |
| `verificationMethod` | A DID URL identifying the public key, e.g. `did:web:averyreads.example#key-1`. The DID it dereferences within MUST be the manifest's `metadata.publisher.id` |
| `proofPurpose` | MUST be `"assertionMethod"` |
| `proofValue` | Multibase-encoded signature per the cryptosuite |

Verifiers MUST reject a proof whose `verificationMethod` does not resolve within the publisher's DID document under the `assertionMethod` relationship, and MUST reject a proof whose controlling DID differs from `metadata.publisher.id`. This binding — the key that signed is a key of the publisher named inside the signed bytes — is what prevents a valid signature by *someone* from being presented as a signature by the claimed publisher.

### 3.3 Cryptosuites

- **`eddsa-jcs-2022`** ([VC-DI-EdDSA](https://www.w3.org/TR/vc-di-eddsa/)) is REQUIRED. Conforming publishing implementations MUST be able to produce it; conforming subscribing engines MUST be able to verify it. Every Signed Manifest MUST carry at least one `eddsa-jcs-2022` proof.
- **`ecdsa-jcs-2019`** ([VC-DI-ECDSA](https://www.w3.org/TR/vc-di-ecdsa/)) is OPTIONAL, for deployments whose key infrastructure is P-256/P-384 bound.
- Other Data Integrity cryptosuites, and the VC JOSE/COSE securing mechanism, are OPTIONAL. They MAY appear only as additional proofs alongside the REQUIRED one.

An engine that encounters only proofs it cannot verify MUST treat the manifest as unverified (Section 4.3), not as valid. Cryptosuite agility is a downgrade surface; the "at least one `eddsa-jcs-2022` proof" rule exists so that a conforming verifier never has a legitimate reason to accept a weaker-only proof set (see [Threat Model §4.6](./threat-model.md)).

### 3.4 DID methods and resolution

LensPub is DID-method-agnostic in general: any method whose DID documents express Ed25519 verification methods can identify a Lens Publisher. For the reference implementation, and as the RECOMMENDED interoperability baseline, **`did:web` and `did:key` are REQUIRED**:

- [`did:web`](https://w3c-ccg.github.io/did-method-web/) binds a publisher identity to control of a domain — appropriate for Expert and Organization Lenses, where the domain is itself a meaningful, independently checkable claim ("this lens really comes from the operator of `example-university.example`"). Resolution is an HTTPS fetch of the DID document; engines MUST validate the TLS channel and SHOULD cache DID documents with the fetch privacy cautions of [Privacy Model §6](./privacy-model.md).
- [`did:key`](https://w3c-ccg.github.io/did-key-spec/) is self-certifying and resolves entirely offline — appropriate for Partner Lenses and pseudonymous publishers. It offers no rotation (the key *is* the identifier); Section 5 consequences apply.

Engines MAY support additional methods and MUST clearly indicate, in the verification-status surface of Section 4.3, which method underlies a publisher identity, because the methods carry different real-world meaning: `did:web` proves domain control at resolution time; `did:key` proves only continuity of a key.

### 3.5 Example

A minimal Signed Manifest for the running example persona — Avery publishing the public lens `avery-daily` (validates against [`schemas/lens-manifest.schema.json`](../schemas/lens-manifest.schema.json)):

```json
{
  "lenspub": "0.1",
  "type": "LensManifest",
  "id": "https://averyreads.example/lenses/avery-daily",
  "metadata": {
    "name": "avery-daily",
    "description": "Avery's daily reading lens: technical research emphasized, provenance surfaced.",
    "lensVersion": "1.4.0",
    "created": "2026-03-02T09:00:00Z",
    "modified": "2026-07-01T18:12:00Z",
    "publisher": {
      "id": "did:web:averyreads.example",
      "name": "Avery",
      "kind": "individual"
    }
  },
  "interpretation": {
    "sources": {
      "trusted": [
        { "origin": "arxiv.org", "weight": 0.9, "note": "Primary literature first." }
      ],
      "requireProvenance": ["citations", "publication-date"]
    }
  },
  "adaptation": {
    "defaultPolicy": "balanced"
  },
  "versionHistory": [
    {
      "lensVersion": "1.3.0",
      "hash": "8f4e1c2ab97d5b3305c0f1a4e6d28b9c7a015f3e4d2c6b8a90e1f2d3c4b5a697",
      "date": "2026-06-10T10:00:00Z"
    },
    {
      "lensVersion": "1.4.0",
      "hash": "2d9c0b1a4f6e8d7c5b3a29180f7e6d5c4b3a2918070605040302010f0e0d0c0b",
      "date": "2026-07-01T18:12:00Z",
      "proposalId": "prop-2026-07-01-01"
    }
  ],
  "proof": {
    "type": "DataIntegrityProof",
    "cryptosuite": "eddsa-jcs-2022",
    "created": "2026-07-01T18:15:00Z",
    "verificationMethod": "did:web:averyreads.example#key-1",
    "proofPurpose": "assertionMethod",
    "proofValue": "z2vFvXKqZ7d8PBiuBh3M9pXcW1EPQjJfmi5w8SkyoLR6VYtNsCkvGdEHhw7st9M2BqDzTFQK4uNn6c8SxBb1P9nGE"
  }
}
```

## 4. Verification Requirements

Verification is not a one-time act. It happens at subscription time and again on **every** update, and its output is always surfaced to the user, never consumed silently.

### 4.1 At subscription time

When a user subscribes to a Published Lens, the engine MUST execute the following pipeline — **verify → pin → diff → propose** — in order, aborting on any failure:

1. **Verify.** Fetch the manifest; validate it against [`schemas/lens-manifest.schema.json`](../schemas/lens-manifest.schema.json); resolve the publisher DID; verify at least one Data Integrity proof per Section 3; check any applicable VC status entry (Section 5). A manifest that fails schema validation, carries no verifiable proof, or names a publisher whose DID does not control the signing key MUST NOT be subscribed to.
2. **Pin.** Record the publisher DID, the verified verification method(s), the manifest's `metadata.lensVersion`, and the content hash of the verified manifest bytes. This pin is the reference point for all future updates and for the rollback checks of Section 6. If the subscription sets `pinnedVersion`, that version is additionally an update ceiling the user has chosen.
3. **Diff.** Produce a Lens Diff (`comparison: "subscription-review"`, per [`schemas/lens-diff.schema.json`](../schemas/lens-diff.schema.json)) showing what the subscription would contribute relative to the user's current effective settings.
4. **Propose.** Present the subscription's effect through the proposal workflow of the [Adaptation Model](../spec/adaptation-model.md). Subscribing is itself a manifest change (a new entry in `subscriptions`) and is never applied without the user's explicit confirmation.

One-time *import* of a manifest (copying, forking) is distinct from subscription: an engine MAY import an unsigned manifest as a static copy after showing an explicit warning that its origin cannot be verified, but MUST NOT establish an update channel to an unsigned source.

### 4.2 On every update

For each new version obtained through a subscription, the engine MUST: re-verify the proof; verify that the signing key belongs to the pinned publisher DID (re-resolving the DID document, subject to Section 5); enforce version monotonicity and hash-chain continuity per Section 6; generate a Lens Diff against the currently adopted version; and surface the update as a Lens Change Proposal. Subscription updates are subject to the user's Adaptation Policy like any other proposal: they are never applied silently, and impact classes above the `autoAcceptCeiling` always require explicit review ([ADR-0010](../adr/0010-adaptation-policies-parameterized.md)). The update-as-proposal choke point is the single most load-bearing mitigation in the [Threat Model](./threat-model.md) (§4.8); engines MUST NOT provide any configuration that bypasses it.

### 4.3 Failure handling and verification-status UX

On verification failure of an update, the engine MUST reject the update, retain the last verified version, and alert the user with the specific failure class (bad signature, key mismatch, revoked status, schema violation, version regression). It MUST NOT retry silently against alternate sources. Verification status — verified (with DID method), unverified, failed, revoked — MUST be visible wherever a Published Lens or its publisher is displayed, and MUST be presented before any subscribe or accept action. The UX requirements are elaborated in [docs/user-experience.md](../docs/user-experience.md); the security requirement here is only that status exists, is accurate, and is never elided.

## 5. Key Rotation and Compromise Recovery

Publisher keys will rotate, and some will be compromised. The protocol's obligations:

**Rotation (planned).** A publisher using a rotation-capable DID method (e.g., `did:web`) rotates by updating its DID document. During a transition window the publisher SHOULD sign new manifest versions with a proof set containing both old and new keys, and SHOULD publish a rotation announcement: a new manifest version whose diff is metadata-only, giving subscribers a signed statement under the old key that the new key is legitimate. Engines encountering a new signing key that is present in the current DID document MUST treat the update as valid but SHOULD note the key change in the update proposal. `did:key` publishers cannot rotate; a new key is a new publisher identity, and engines MUST treat it as such (full re-subscription, no continuity claim).

**Compromise (unplanned).** A publisher recovering from key compromise MUST remove the compromised verification method from its DID document and SHOULD revoke any publisher attestation VCs bound to it using a VC status mechanism ([Bitstring Status List](https://www.w3.org/TR/vc-bitstring-status-list/) is the RECOMMENDED mechanism). Subscriber behavior on detecting removal or revocation: the engine MUST pause the subscription's update channel, MUST mark previously adopted versions from that publisher as trust-suspended in the UI, and MUST require explicit user re-confirmation before resuming — the user decides whether to keep the already-adopted content, roll back, or unsubscribe. Engines SHOULD re-resolve publisher DID documents and re-check status lists periodically (RECOMMENDED: at least as often as they poll for updates), not only when an update arrives; a compromised key with no new updates is otherwise never noticed.

**Honest limitation.** Revocation checking depends on the publisher's DID document and status list being reachable and truthful. An attacker who controls the publisher's domain controls `did:web` rotation. LensPub deliberately has no central authority that can override this ([ADR-0003](../adr/0003-adopt-vc2-dids-for-trust.md) alternatives); domain compromise of a publisher is analyzed as residual risk in [Threat Model §4.5](./threat-model.md).

## 6. Rollback Protection

A signature proves authorship, not freshness: an old, signed, genuinely defective manifest version verifies perfectly. Engines MUST therefore enforce, for every subscription update:

1. **Version monotonicity.** The incoming `metadata.lensVersion` MUST be strictly greater (semantic-version comparison) than the pinned version. Equal or lower versions MUST be rejected as downgrades.
2. **Hash-chain continuity.** The incoming manifest's `versionHistory` MUST contain an entry whose `lensVersion` and `hash` match the pinned version. Because `versionHistory` is inside the signed bytes (Section 3.1), a publisher's version lineage is a signed hash chain; an update that "forgets" the version the subscriber holds is either a rollback, a fork, or history rewriting, and MUST be rejected.
3. **Hash verification.** The engine MUST recompute the content hash of each accepted version and record it; recorded hashes are what monotonicity and continuity checks compare against, not values asserted by the incoming document alone.

Downgrades are refused, not forbidden absolutely: there are legitimate reasons to move backward (a publisher retracts a defective version). An engine MAY offer a downgrade as an explicit, user-confirmed action, presented with the same diff-and-propose treatment as any update plus an unambiguous warning that the change moves to an older version.

**Honest limitation.** These checks stop an attacker from *replacing* the subscriber's current version with an older one. They do not guarantee freshness: a hostile subscription source can withhold new versions indefinitely, and a subscriber who first encounters a publisher through a stale mirror pins a stale version. v1 has no transparency log or timestamping service; engines SHOULD surface last-update times so staleness is at least visible. See [Threat Model §4.7](./threat-model.md).

## 7. Integrity of the Local Lens Store

The local lens store holds the user's manifest versions, Adaptation State, and cached Interpretation Results. At-rest confidentiality and access control are the **host platform's duty** — OS user separation, browser profile isolation, full-disk encryption. LensPub does not attempt to encrypt data against an attacker who already controls the device; Section 7 of the [Threat Model](./threat-model.md) declares privileged local malware out of scope, and pretending otherwise would be security theater.

What the engine MUST do is *detect* store tampering and corruption within its own trust assumptions:

- On loading any manifest version, recompute its content hash and compare against the recorded Lens Version hash; verify `versionHistory` chain consistency across stored versions.
- On mismatch, refuse to apply the affected version, quarantine it, alert the user, and offer recovery to the most recent version that verifies.
- Signed Manifests obtained via subscription retain their proofs in the store; the engine SHOULD re-verify proofs (which requires no network, per Section 3.1) as part of tamper detection.

This detects accidental corruption, sync faults, and unprivileged or low-effort tampering. It does not detect a privileged attacker who rewrites both the data and the recorded hashes — that attacker has already won at a layer below the protocol.

## 8. Engine Supply Chain

The engine is the fully trusted component (Section 2.2), so its provenance is a first-order security property, not an operational nicety.

- **No remote code.** A conforming engine MUST NOT download and execute code, rules, or prompt templates at runtime from outside its reviewed distribution package. For the browser reference implementation this aligns with, and is required independently of, the Manifest V3 prohibition on [remotely hosted code](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code): everything that determines interpretation behavior ships in the store-reviewed package. Prompt templates are versioned and hashed, and the hash appears in every Reproducibility Envelope ([ADR-0004](../adr/0004-reproducibility-envelope.md)) — a template change is therefore user-visible evidence, not a silent behavioral shift.
- **Reproducible builds.** Engine distributions SHOULD be reproducibly buildable from published source, so that third parties can confirm the shipped artifact matches the audited code. The reference implementation ([architecture/reference-implementation.md](../architecture/reference-implementation.md), Apache-2.0) treats reproducibility as a release goal; where a platform's packaging pipeline makes bit-exact reproduction impossible, the project SHOULD publish the transformation steps and their expected outputs.
- **Dependency discipline.** Engines SHOULD pin dependencies by hash and SHOULD publish a software bill of materials with each release.
- **Model artifacts.** For local-model engines, model weights are part of the supply chain: engines SHOULD verify model files by hash before load, and the hash appears in the Reproducibility Envelope's `model.hash` field.

## 9. Update Security: Engine Updates versus Lens Updates

Two different things update through two different channels, and conflating them is a design error this section exists to prevent:

- **Lens updates** (new manifest versions, from the user's own accepted proposals or from subscriptions) travel through the verification pipeline of Section 4 and the proposal workflow. Authorization: the user, per update.
- **Engine updates** (new engine code) travel through the host platform's software-update channel — extension store signing and review for the browser reference implementation, package management elsewhere. Authorization: platform signature plus the user's update settings.

Both channels MUST be non-silent. Lens updates are non-silent by the proposal workflow. Engine updates are made non-silent by requirement: an updated engine MUST surface its new version to the user (notification, changelog access) and the engine version recorded in every Reproducibility Envelope makes the change permanently visible in the interpretation record — an interpretation that changed because the engine changed is attributable as such ([ADR-0004](../adr/0004-reproducibility-envelope.md)). An engine update MUST NOT modify any Lens Manifest, silently migrate manifest semantics, or alter Adaptation Policy parameters; where a schema migration is genuinely required, it MUST be presented as a Lens Change Proposal like any other change.

The residual exposure is real and stated plainly: on most platforms engine updates are pushed by a store the user does not control, so a coerced or compromised engine vendor is equivalent to a malicious engine for the duration of an update cycle. Reproducible builds and open source narrow the window from "undetectable" to "detectable by anyone who checks"; they do not close it. See [Threat Model §3](./threat-model.md) (coercive platform) and [§6](./threat-model.md).

## 10. Relationship to the Privacy and Threat Models

This document defines the mechanisms; its two companions complete the analysis. The [Privacy Model](./privacy-model.md) specifies which data may cross which boundary — in particular why signing and publication are also *disclosure* events requiring pre-publication review. The [Threat Model](./threat-model.md) walks the constitution's ten named threats against the mechanisms defined here and records the residual risk of each honestly. A conforming implementation is expected to satisfy all three documents together; they are severable only for reading, not for conformance.
