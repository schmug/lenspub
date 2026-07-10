# Lens Diff Specification

**Status:** Draft v0.1 · **Date:** 2026-07-09 · **License:** CC-BY 4.0

This document specifies the Lens Diff, the LensPub exchange object that represents a structured, semantic comparison between two Lens Manifests. It defines the canonical comparison modes, the privacy property that diffs inherit from the history-free manifest core ([ADR-0006](../adr/0006-history-free-shareable-core.md)), the canonicalization rules applied before comparison, the representation of individual changes, the impact classification carried by each change, and requirements for presenting diffs to people. The Lens Diff serialization is normatively defined by [`schemas/lens-diff.schema.json`](../schemas/lens-diff.schema.json); this document defines the semantics of producing and rendering it.

The key words MUST, MUST NOT, REQUIRED, SHALL, SHALL NOT, SHOULD, SHOULD NOT, RECOMMENDED, NOT RECOMMENDED, MAY, and OPTIONAL in this document are to be interpreted as described in BCP 14 [RFC 2119] [RFC 8174] when, and only when, they appear in all capitals.

## 1. Introduction

A Lens Manifest is a declarative, model-agnostic policy document ([ADR-0001](../adr/0001-manifest-is-declarative-policy.md)); because it is declarative, two manifests can be compared field by field, and the comparison is meaningful to the person whose preferences the fields express. The Lens Diff makes the constitution's "never silently changes" guarantee auditable: every difference between two manifest versions is enumerable, attributable to a field, classifiable by impact, and expressible in a sentence a non-specialist can read.

A Lens Diff is a description of change intended for human review and for review tooling. It is deliberately not an executable patch format: although its operation names resemble those of JSON Patch [RFC 6902], a Lens Diff is not guaranteed to be mechanically applicable (Section 6.2), and applying diffs is out of scope. Manifest versions are produced by the adaptation workflow defined in the [Adaptation Model](./adaptation-model.md) and by direct manual edit, never by patch application.

The media type for the Lens Diff is `application/lens-diff+json` and its schema identifier lives under the namespace `https://lenspub.org/ns/`; both are provisional pending permanent registration.

## 2. Conformance and terminology

This document defines two conformance targets:

- **Differ** — a component that takes two Lens Manifests and produces a Lens Diff. Differs are typically embedded in Lens Engines or lens-management tooling but may be standalone.
- **Diff renderer** — a component that presents a Lens Diff to a user.

Capitalized terms — Lens Manifest, Lens Engine, Lens Change Proposal, Adaptation Policy, Domain Scope, Published Lens, Subscription — are used as defined in the [Glossary](../GLOSSARY.md). A Lens Diff produced by a conforming differ MUST validate against [`schemas/lens-diff.schema.json`](../schemas/lens-diff.schema.json). Where this prose and the schema disagree, the schema is authoritative for structure and this document for semantics.

## 3. Comparison modes

The `comparison` member records which of four canonical comparisons a diff represents. The first three are the comparisons the LensPub constitution names; the fourth serves the adaptation workflow. Differs SHOULD populate `comparison`; renderers SHOULD adapt their framing to it.

| Mode | `from` | `to` | Typical question |
|---|---|---|---|
| `self-over-time` | An earlier version of the user's lens | A later version of the same lens | "How has my lens changed since March?" |
| `self-vs-other` | The user's lens | Another user's or Published Lens | "How does my lens differ from this expert's?" |
| `subscription-review` | The subscribed lens version last reviewed or pinned | The publisher's current version | "What changed before I accept this subscription update?" |
| `proposal-preview` | The user's current manifest | The manifest as it would be after an accepted Lens Change Proposal | "What exactly am I being asked to approve?" |

In `self-over-time` and `proposal-preview` the `from.id` and `to.id`, when present, refer to the same lens. In `subscription-review`, the diff is the object presented during update-as-proposal review as defined in the [Adaptation Model](./adaptation-model.md). Each side of a comparison is identified by a `manifestRef` giving `lensVersion` (REQUIRED) and optionally `id`, `name`, and the content `hash` of the referenced manifest version. Differs SHOULD include `hash` whenever the referenced version is content-addressed, computed over the canonical form defined in Section 5.1.

## 4. Privacy: history-free inputs only

Lens Diffs inherit their privacy property from what they operate on, not from any redaction step. Under [ADR-0006](../adr/0006-history-free-shareable-core.md), the shareable object — and therefore the diffable object — is the history-free manifest core: it contains preferences and policies only, never URLs visited, content excerpts, reading timestamps, or feedback records. Adaptation State never appears in either input, so no diff over conforming inputs can expose browsing history. All three interpersonal comparisons above are safe by construction for the same reason a published lens is.

This property holds only if differs refuse to process anything else:

1. A differ MUST validate both inputs against [`schemas/lens-manifest.schema.json`](../schemas/lens-manifest.schema.json) before comparison.
2. A differ MUST refuse — with an error, producing no Lens Diff — any input containing fields not defined by that schema. It MUST NOT skip, strip, or silently ignore unrecognized fields and diff the remainder. An unrecognized field is exactly where history-derived data would hide, and a differ that tolerates it becomes the channel that renders such data into summaries and review screens.
3. The `extensions` member is the sole schema-sanctioned open object. Differences inside it are reported under the `extensions` category (Section 6) but a differ MUST NOT interpret extension content; it MAY represent such a difference as a single opaque change at the deepest common pointer.
4. A differ MUST NOT consult any source other than the two manifests — no engine state, no Adaptation State, no network retrieval of referenced lenses beyond obtaining the manifests themselves.

Residual inference risk (a manifest that trusts a small local newspaper reveals an interest) is a property of manifests, not diffs, and is addressed by pre-publication disclosure review in the [Privacy Model](../security/privacy-model.md).

## 5. Canonicalization before comparison

Two manifests that mean the same thing must produce an empty diff regardless of serialization accidents. Differs therefore compare canonical forms, not bytes.

### 5.1 JCS canonical form

Before comparison, a differ MUST transform both inputs into the canonical form defined by the JSON Canonicalization Scheme (JCS) [RFC 8785]. JCS fixes object-member ordering, string escaping, and number serialization, so member order and numeric spelling (`0.4` versus `0.40`) never register as differences. Two values are equal exactly when their JCS serializations are byte-identical. Manifest content hashes referenced from `manifestRef.hash`, and content addressing of Lens Versions generally, SHOULD be computed over the JCS form. JCS does not reorder arrays; array handling is defined next.

### 5.2 Keyed-set arrays

Four manifest arrays hold objects whose identity is a natural key rather than a position. A differ MUST compare these as keyed sets, insensitive to element order:

| Array | Key |
|---|---|
| `/interpretation/priorities` | `topic` together with the set of `domains` (order-insensitive; an absent `domains` means lens-wide and is distinct from any restriction) |
| `/interpretation/sources/trusted` and `/interpretation/sources/distrusted` | `origin` |
| `/adaptation/domainPolicies` | `domain` |
| `/subscriptions` | `lens` |

Elements present on both sides under the same key are matched and compared member-by-member, recursively; nested differences are reported at their precise pointer (e.g. a changed `weight` inside a matched priority). An element whose key exists only in `to` is one `add` of the whole element; only in `from`, one `remove`. Reordering keyed elements produces no changes. A change to a key member itself (a renamed `topic`, a changed `origin`) necessarily appears as a `remove`/`add` pair, which is semantically accurate: it is a different preference, not an edit to the old one. If a key value occurs more than once within one array on one side, the keyed-set rule is inapplicable and the differ MUST fall back to positional comparison for that array.

### 5.3 All other arrays

Every other array — including `domains`, `requireProvenance`, the `domains` restriction lists inside priorities and subscriptions, and `selectors`-style lists in other LensPub objects — is compared positionally: index *i* against index *i*, with length differences reported as `add` or `remove` at the trailing indices.

### 5.4 Excluded fields

The following manifest members are version machinery, not preferences, and a differ MUST exclude them from change enumeration: `/metadata/lensVersion` and `/metadata/modified` (already carried by the `from`/`to` refs), `/versionHistory` (grows with every version by construction), and `/proof` (signature material; verification is the [Security Model](../security/security-model.md)'s concern, not the differ's). All other `metadata` members — `name`, `description`, `publisher`, `lineage`, `language`, `created` — are compared normally.

## 6. Change representation

The `changes` array is the substance of a Lens Diff. Each entry is one atomic difference:

| Member | Req. | Meaning |
|---|---|---|
| `op` | REQUIRED | `add`, `remove`, or `replace` |
| `path` | REQUIRED | JSON Pointer [RFC 6901] into the Lens Manifest |
| `before` | conditional | Canonical value at `path` in `from`; absent for `add`, present otherwise |
| `after` | conditional | Canonical value at `path` in `to`; absent for `remove`, present otherwise |
| `category` | REQUIRED | One of `metadata`, `domains`, `priorities`, `sources`, `presentation`, `adaptation`, `privacy`, `subscriptions`, `extensions` |
| `impact` | REQUIRED | `trivial`, `minor`, or `major` (Section 7) |
| `summary` | REQUIRED | One human-readable sentence describing the change |

### 6.1 Operation semantics

`add` states that a value exists in `to` at a location with no counterpart in `from`; `remove` the converse; `replace` states that matched locations hold values whose JCS serializations differ. There are no `move`, `copy`, or `test` operations: order changes in keyed sets are non-changes (Section 5.2), and a Lens Diff asserts nothing about how the `to` manifest was produced.

### 6.2 Pointer evaluation

For `add` and `replace`, `path` is evaluated against the `to` manifest; for `remove`, against the `from` manifest. Array indices in a pointer are the element's index in the referenced input document (JCS preserves array order). Because pointers in one diff refer to two different documents, the `changes` array is not, in general, an applicable JSON Patch [RFC 6902] document, and consumers MUST NOT treat it as one.

### 6.3 The summary

Every change carries a REQUIRED `summary`: diffs are for people first, and the summary is the member a renderer shows when it shows only one thing. A summary MUST be a single self-contained sentence stating what changed in the vocabulary of preferences, not of JSON. It SHOULD name the human-meaningful identity of the changed thing — the priority's `topic`, the source's `origin`, the Domain Scope's id or label — rather than the pointer, and SHOULD state the old and new values where they are short (weights, policy names, enum settings). Summaries SHOULD be written in the language given by the `to` manifest's `metadata.language`, when present. A differ MUST generate summaries mechanically from the structural change; a summary MUST NOT speculate about motive or effect beyond what the changed field denotes.

### 6.4 Ordering

Differs SHOULD emit changes grouped by `category` in the order the categories' subjects appear in the manifest schema (`metadata`, `domains`, then interpretation members, `adaptation`, `privacy`, `subscriptions`, `extensions`), so that independently implemented differs produce identical output for identical inputs. Renderers are free to re-order for presentation (Section 9).

## 7. Impact classification

Each change carries an `impact` of `trivial`, `minor`, or `major`. These are the same three classes the Adaptation Model uses for Lens Change Proposals — the classes that `autoAcceptCeiling` is defined over ([ADR-0010](../adr/0010-adaptation-policies-parameterized.md)) — and the [Adaptation Model specification](./adaptation-model.md) is their sole normative source. This document deliberately does not restate the classification rules: a single definition keeps a proposal's declared impact and its `proposal-preview` diff's per-change impacts consistent by construction. A differ MUST classify every change according to those rules, and MUST classify a change it cannot otherwise determine as `major`; failing toward review is the safe direction.

## 8. Totals

The OPTIONAL `totals` object summarizes the diff: `added`, `removed`, and `replaced` are counts of changes by `op`, and `highestImpact` is the maximum `impact` across all changes, or `none` when `changes` is empty. Differs SHOULD emit `totals`; when present, its counts MUST equal the actual counts in `changes` and `highestImpact` MUST be consistent with them. `highestImpact` exists so that review interfaces and Adaptation Policy machinery can triage a diff without scanning it — a `subscription-review` diff whose `highestImpact` is `major` warrants different prominence than one that is all `trivial`.

## 9. Presentation

Renderers turn the diff into the review moment the adaptation workflow depends on, so presentation carries normative weight:

- A renderer MUST display every change; it MUST NOT truncate or collapse changes irrecoverably. It MUST render each change's `summary` and impact class, and SHOULD make `path`, `before`, and `after` available on demand for inspection.
- A renderer SHOULD offer a side-by-side view of the two manifests (or the affected regions), with changed locations aligned, since "compare two versions of myself" is inherently a two-column reading task.
- Each change SHOULD be rendered in plain language, using the `summary` as the primary line; renderers MAY regenerate richer phrasings from the structural members but MUST NOT contradict them.
- Changes SHOULD be presented with higher-impact changes more prominent (e.g. `major` first), and `highestImpact` SHOULD be visible before the user opens the change list.
- In `subscription-review` and `proposal-preview` contexts, the rendered diff is part of a review screen whose further requirements (evidence counts, shadow comparison, accept/reject/modify) are defined in the [Adaptation Model](./adaptation-model.md); the diff renderer supplies the "what changed" panel of that screen.

## 10. Example

The following complete Lens Diff records the change from version 1.3.0 to 1.4.0 of Avery's lens `avery-daily`: a priority weight raised, a trusted source added, and the politics Domain Scope locked. It validates against [`schemas/lens-diff.schema.json`](../schemas/lens-diff.schema.json) and is available as [`examples/diffs/avery-daily-1.3.0-to-1.4.0.json`](../examples/diffs/avery-daily-1.3.0-to-1.4.0.json).

```json
{
  "lenspub": "0.1",
  "type": "LensDiff",
  "comparison": "self-over-time",
  "generated": "2026-07-09T16:20:00Z",
  "from": {
    "id": "https://avery.example/lenses/avery-daily",
    "name": "avery-daily",
    "lensVersion": "1.3.0",
    "hash": "23cbfd797df94bb6f8f68c1e9a46f42a3481f6301bce1cabf9c9d7b550db5164"
  },
  "to": {
    "id": "https://avery.example/lenses/avery-daily",
    "name": "avery-daily",
    "lensVersion": "1.4.0",
    "hash": "b8cd3ee8c4df7e51a1341f55e7acada58bdc3ecdd4bed779b1ead9564be35d65"
  },
  "changes": [
    {
      "op": "replace",
      "path": "/interpretation/priorities/1/weight",
      "before": 0.4,
      "after": 0.7,
      "category": "priorities",
      "impact": "minor",
      "summary": "Raises the emphasis on topic 'model-evaluation' in the tech-research domain scope from 0.4 to 0.7."
    },
    {
      "op": "add",
      "path": "/interpretation/sources/trusted/3",
      "after": {
        "origin": "openreview.net",
        "weight": 0.9,
        "note": "Reviews are public and attributable to named or accountable reviewers."
      },
      "category": "sources",
      "impact": "minor",
      "summary": "Adds openreview.net as a trusted source with weight 0.9."
    },
    {
      "op": "replace",
      "path": "/adaptation/domainPolicies/0/policy",
      "before": "balanced",
      "after": "locked",
      "category": "adaptation",
      "impact": "major",
      "summary": "Changes the Adaptation Policy for the politics domain scope from Balanced to Locked, so the lens will no longer propose changes in that scope."
    }
  ],
  "totals": {
    "added": 1,
    "removed": 0,
    "replaced": 2,
    "highestImpact": "major"
  }
}
```

Reading the example against this specification: the pointer `/interpretation/priorities/1/weight` indexes the matched priority's position in the 1.4.0 manifest (Section 6.2); the added source appears as a single `add` of the whole keyed element (Section 5.2); the `metadata.lensVersion` bump from 1.3.0 to 1.4.0 is carried by the `from`/`to` refs and correctly absent from `changes` (Section 5.4); and `highestImpact: "major"` tells a renderer — before the list is opened — that this version step included a change of the class that always requires explicit review.

## 11. References

- [Lens Manifest Specification](./lens-manifest.md); [Adaptation Model](./adaptation-model.md); [Lens Engine Specification](./lens-engine.md)
- [`schemas/lens-diff.schema.json`](../schemas/lens-diff.schema.json); [`schemas/lens-manifest.schema.json`](../schemas/lens-manifest.schema.json)
- [ADR-0001](../adr/0001-manifest-is-declarative-policy.md), [ADR-0006](../adr/0006-history-free-shareable-core.md), [ADR-0010](../adr/0010-adaptation-policies-parameterized.md)
- RFC 6901 (JSON Pointer), RFC 6902 (JSON Patch, contrasted), RFC 8785 (JSON Canonicalization Scheme), RFC 2119 / RFC 8174 (BCP 14)
