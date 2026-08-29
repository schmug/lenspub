# Adaptation Model Specification

**Status:** Draft v0.1 · **Date:** 2026-07-09 · **License:** CC-BY 4.0

This document specifies how a Lens evolves. Adaptation in LensPub is never silent: a Lens Manifest changes only through a normative proposal workflow — observe, accumulate, propose, evaluate, review, version — governed by user-selected Adaptation Policies. This document defines the workflow as a state machine, enumerates the explicit feedback events that may drive it, defines the required content of a Lens Change Proposal, fixes the deliberately coarse impact classification for proposed changes, gives normative parameter values for the five named Adaptation Policy presets, and specifies precedence, rollback, and history-inspection requirements.

The key words MUST, MUST NOT, REQUIRED, SHALL, SHALL NOT, SHOULD, SHOULD NOT, RECOMMENDED, NOT RECOMMENDED, MAY, and OPTIONAL in this document are to be interpreted as described in BCP 14 [RFC 2119] [RFC 8174] when, and only when, they appear in all capitals.

## 1. Introduction and Scope

The constitution's guarantee that a lens "never silently changes" applies to the Lens Manifest, which is versioned and changes only through the workflow specified here ([ADR-0004](../adr/0004-reproducibility-envelope.md)). The private, device-local material that drives adaptation — feedback records, accumulated evidence, pending proposals, evaluation data — is Adaptation State, structurally separated from the shareable manifest core so that history leakage is impossible by construction ([ADR-0006](../adr/0006-history-free-shareable-core.md)). This document binds any Lens Engine that implements adaptation; an engine MAY implement no adaptation at all, in which case the lens changes only by direct manual edit. Terms used here are defined in the [Glossary](../GLOSSARY.md); the manifest fields referenced are defined in [`../schemas/lens-manifest.schema.json`](../schemas/lens-manifest.schema.json).

## 2. Conformance

An engine conforms to this specification if every modification it ever makes to a Lens Manifest arises from an accepted Lens Change Proposal, a direct manual edit by the user, or a rollback (Section 7); if it enforces the effective Adaptation Policy parameters of Section 5 exactly; and if it satisfies the state-machine requirements of Section 3. Auto-acceptance of a proposal above the effective `autoAcceptCeiling` is a conformance violation ([ADR-0010](../adr/0010-adaptation-policies-parameterized.md)).

## 3. The Proposal Workflow

The lifecycle of a lens change is the following state machine. States are properties of a *candidate change* within Adaptation State; the manifest itself changes only at the final transition.

```
observe → accumulate → propose → evaluate (optional) → review → version
                                      ↑______________________|
                                          (modify loops back to review)
rejected proposals → cooldown; accepted proposals → new manifest version
```

### 3.1 Observe

Adaptation evidence comes from explicit feedback only. Version 0.1 defines the following feedback event types:

- `approve-annotation` — the user endorses an Overlay Annotation through an explicit affordance;
- `reject-annotation` — the user explicitly rejects one;
- `request-more-of-topic` — the user asks for more emphasis on a topic;
- `request-less-of-topic` — the user asks for less;
- `trust-source` — the user marks a source as trusted;
- `distrust-source` — the user marks a source as distrusted;
- `manual-edit` — the user directly edits the manifest.

A `manual-edit` takes effect immediately as a new manifest version (it does not pass through the proposal workflow, and is permitted even under the Locked policy) but is also recorded as evidence, since it is the strongest available signal of intent. Implicit signals — dwell time, scroll depth, hover, click-through, or any other behavioral inference — MUST NOT create proposals and MUST NOT count toward evidence thresholds in v0.1. Merely dismissing an annotation is not feedback ([Lens Engine Specification, Section 6.3](./lens-engine.md)). Relaxing this restriction would be a protocol change and is discussed only in the [Roadmap](../docs/roadmap.md).

### 3.2 Accumulate

Feedback events are recorded as Adaptation State: device-local, user-reviewable, never published, and syncable between the user's own devices only over an end-to-end-encrypted channel ([ADR-0006](../adr/0006-history-free-shareable-core.md)). Evidence accumulates per Domain Scope, against candidate changes (for example, "raise the weight of priority *on-device inference*"). A proposal for a candidate change MUST NOT be raised until the number of explicit feedback events supporting it reaches the effective `evidenceThreshold` (Section 5); engines SHOULD net countervailing events against supporting ones. Feedback on content not classified into any declared Domain Scope accumulates against the lens-wide default policy.

### 3.3 Propose

When evidence reaches threshold and the frequency budget permits, the engine raises a **Lens Change Proposal** (object type name `LensChangeProposal`). A Lens Change Proposal MUST contain:

1. **A stable proposal identifier**, referenced by `versionHistory[].proposalId` if the proposal is accepted.
2. **The base manifest version** (its `lensVersion` and hash) the proposal applies to.
3. **The proposed change as a Lens Diff fragment**: one or more change objects conforming to the `changes` items of [`../schemas/lens-diff.schema.json`](../schemas/lens-diff.schema.json) — `op`, `path`, `before`/`after`, `category`, `impact`, and a human-readable `summary`. Engines SHOULD present the fragment to the user as a full Lens Diff with `comparison` set to `proposal-preview`.
4. **An evidence summary**: aggregate counts of supporting feedback events per event type and Domain Scope. The summary MUST NOT include raw history — no URLs, no content excerpts, no timestamps, no individual event records.
5. **The impact class** of the proposal: the highest impact among its change objects, per Section 4.
6. OPTIONALLY, **a shadow-evaluation offer** or a reference to shadow-evaluation results (Section 3.4).

`LensChangeProposal` is governed by [`../schemas/lens-change-proposal.schema.json`](../schemas/lens-change-proposal.schema.json), which is normative for the object's structure: a Lens Change Proposal MUST validate against it. That a proposal is never exchanged does not make its shape a private matter. Two independent engines given the same evidence must build the same object, and a conformance suite must be able to run proposals as test vectors, so the structure is specified even though no instance is ever published — the same status the [Interpretation Result](../schemas/interpretation-result.schema.json) already holds. A published schema confers no mobility: a Lens Change Proposal remains Adaptation State, device-local, never published or exported, and MUST NOT leave the user's device except over an end-to-end-encrypted channel between the user's own devices ([ADR-0006](../adr/0006-history-free-shareable-core.md)). It has no media type, and none is reserved for it ([LensPub Protocol, Section 5](./lenspub-protocol.md)).

The schema enforces item 4 structurally rather than by prose alone. The evidence summary is a closed, count-only shape — an aggregate count per feedback event type and Domain Scope id — and no member of it can hold a URL, a content excerpt, a timestamp, or an individual event record. An engine that would otherwise be careless with history cannot leak it through a proposal without producing a document that fails validation; [`../examples/proposals/`](../examples/proposals/) carries a conforming proposal for the running-example lens alongside counter-examples that the schema rejects for exactly that reason. The change objects a proposal carries are the Lens Diff change-object definition by reference rather than a restatement of it, so proposal previews, subscription reviews, and history diffs cannot drift apart. Item 3's presentation of the fragment — a `proposal-preview` diff for the running-example lens `avery-daily`:

```json
{
  "lenspub": "0.1",
  "type": "LensDiff",
  "from": {
    "id": "https://avery.example/lenses/avery-daily",
    "name": "avery-daily",
    "lensVersion": "1.4.2",
    "hash": "sha-256:c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2"
  },
  "to": {
    "name": "avery-daily (proposal prop-2026-0709-01)",
    "lensVersion": "1.5.0"
  },
  "generated": "2026-07-09T18:30:00Z",
  "comparison": "proposal-preview",
  "changes": [
    {
      "op": "replace",
      "path": "/interpretation/priorities/0/weight",
      "before": 0.8,
      "after": 0.9,
      "category": "priorities",
      "impact": "minor",
      "summary": "Increase the weight of priority 'on-device inference' from 0.8 to 0.9."
    },
    {
      "op": "add",
      "path": "/interpretation/priorities/-",
      "after": {
        "topic": "webgpu benchmarks",
        "weight": 0.4,
        "domains": ["tech-research"]
      },
      "category": "priorities",
      "impact": "minor",
      "summary": "Add priority 'webgpu benchmarks' (weight 0.4) in Domain Scope 'tech-research'."
    }
  ],
  "totals": { "added": 1, "removed": 0, "replaced": 1, "highestImpact": "minor" }
}
```

### 3.4 Evaluate

Before review, the engine MAY offer shadow (A/B) evaluation: running both the current and the proposed lens over content the user subsequently visits and presenting comparative Interpretation Results, each labeled with the lens version that produced it. Shadow-evaluation results are Adaptation State: they reference what the user read and MUST NOT be shared, exported, published, or included in any manifest or Lens Diff. A proposed change MUST NOT acquire any authority during evaluation; in particular, proposed changes to the `privacy` block MUST NOT take effect during shadow evaluation — a proposed remote-inference opt-in cannot cause a single remote call before acceptance.

### 3.5 Review

The user reviews a proposal and accepts, rejects, or modifies it. The review presentation MUST show the diff (with its human-readable summaries — diffs are for people first), the evidence summary, and the impact class. Modification edits the diff fragment and returns to review; a modified proposal that is then accepted is recorded as accepted with the modified diff. Under a policy whose `autoAcceptCeiling` permits it, a proposal at or below the ceiling MAY be auto-accepted — but notification and one-tap rollback are unconditional: the user MUST be notified of every auto-accepted change, and MUST be able to roll it back with a single action directly from that notification. Silent (un-notified) change is prohibited under every policy, including Explorer.

### 3.6 Version

On acceptance, the engine applies the change objects to the manifest, increments `metadata.lensVersion`, and appends a `versionHistory` entry containing the new version, its content hash, the date, and the accepted proposal's identifier. Each version is an immutable, content-addressed snapshot. The semantic-version increment SHOULD follow the impact class: patch for trivial, minor for minor, major for major.

On rejection, the proposal is recorded in Adaptation State (never in `versionHistory`, which is part of the shareable core) and enters **cooldown**: the engine MUST NOT raise a substantially similar proposal — same target paths, same direction of change — for at least twice the minimum proposal interval implied by the effective `proposalFrequency`. Engines SHOULD additionally offer "never propose this again," recorded as a permanent suppression in Adaptation State. Pending proposals whose base version no longer matches the current manifest (after another acceptance, manual edit, or rollback) MUST be re-based or withdrawn, never applied stale.

## 4. Impact Classification

Every change object in a proposal or Lens Diff carries an `impact` of `trivial`, `minor`, or `major`. The classification is deliberately coarse ([ADR-0010](../adr/0010-adaptation-policies-parameterized.md)): it exists so that auto-accept ceilings are meaningful and portable, not to grade changes finely. Engines MUST classify no lower than the rules below; they MAY classify a change more severely, never less.

- **Trivial** — presentation-only changes: changes confined to `/interpretation/presentation`.
- **Minor** — any of: adjusting the `weight` of an existing priority or source where the absolute difference is at most 0.2; adding a priority or trusted source whose weight has absolute value at most 0.5; adding a subscription with `trust` set to `advisory`.
- **Major** — everything else. This includes, without limitation: Adaptation Policy changes, additions to `distrusted` sources, any change under `/privacy`, subscriptions with `trust` set to `adopted` (adding one, or changing an existing subscription's trust to `adopted`), and every removal (`op` of `remove`).

Two blocks are **always major** regardless of the size of the edit: `/privacy` and `/adaptation`. A proposal's impact class is the highest impact among its change objects. Subscribed-lens update proposals ([Lens Engine Specification, Section 8.3](./lens-engine.md)) are classified `major` when the subscription is adopted and `minor` when it is advisory.

## 5. Adaptation Policies

Adaptation Policies are named presets over three protocol-defined parameters ([ADR-0010](../adr/0010-adaptation-policies-parameterized.md)), carried in the manifest's `adaptation` block: `proposalFrequency` (maximum Lens Change Proposals the engine may raise per week per Domain Scope; 0 means never), `evidenceThreshold` (minimum count of explicit feedback events before a proposal may be raised), and `autoAcceptCeiling` (highest impact class that may be auto-accepted; `none` means every proposal requires explicit review). The five preset names — serialized in lowercase per the manifest schema — have the following normative values:

| Preset | `proposalFrequency` (per week per Domain Scope) | `evidenceThreshold` | `autoAcceptCeiling` | Exploratory proposals |
|---|---|---|---|---|
| `locked` | 0 (no proposals; manual edit only) | n/a | `none` | not permitted |
| `conservative` | 0.25 (at most 1 per 4 weeks) | 12 | `none` | not permitted |
| `balanced` | 1 | 6 | `none` | not permitted |
| `adaptive` | 3 | 3 | `trivial` | not permitted |
| `explorer` | 5 | 2 | `minor` | permitted |

Under `locked`, no proposal is ever raised, so the evidence threshold has no effect (the manifest schema requires a value of at least 1 if the parameter is serialized; it is RECOMMENDED to omit `parameters` for `locked`). A `custom` policy sets the three parameters explicitly; explicit `parameters` also override a preset's values. Custom parameters are exchanged like any other manifest field, so a custom policy is exactly as portable as a preset.

**Exploratory proposals** — suggestions not driven by accumulated evidence, such as a novel Domain Scope or a counter-preference suggestion — are permitted only under the `explorer` preset; the v0.1 parameter set has no field granting exploratory permission to a `custom` policy. They MUST be marked as exploratory, count against the `proposalFrequency` budget, are exempt from `evidenceThreshold`, and MUST NOT be auto-accepted regardless of impact class.

**Auto-acceptance** applies only to proposals at or below the effective `autoAcceptCeiling`; acceptance above the ceiling without explicit review is a conformance violation. Notification and one-tap rollback are unconditional for every auto-accepted change (Section 3.5), under every policy.

Subscribed-lens update proposals originate outside the user's own feedback; they do not count against `proposalFrequency` and MAY be surfaced even under `locked` (accepting one is an explicit manual act). Because they are classified at least `minor` (Section 4), an adopted subscription's update (`major`) can never be auto-accepted; an advisory subscription's update (`minor`) MAY auto-accept only under a `minor` ceiling, always notified and rollback-able.

## 6. Precedence

Per-domain policy overrides the lens-wide default: for content classified into a Domain Scope with an entry in `adaptation.domainPolicies`, that entry's policy and parameters govern. When content falls into multiple scopes whose policies differ, or classification is too uncertain to be stated honestly, the engine MUST apply the most restrictive combination parameter-wise: the lowest applicable `proposalFrequency`, the highest applicable `evidenceThreshold`, and the lowest applicable `autoAcceptCeiling` (`none` < `trivial` < `minor`).

Subscriptions never override the user's Adaptation Policy. A subscribed lens's own `adaptation` block governs the publisher's lens, not the subscriber's; it is not merged under any trust mode. A subscription that wishes to suggest a policy change can reach the user only as a Lens Change Proposal, which — touching `/adaptation` — is always major and therefore always explicitly reviewed.

## 7. Rollback

Every prior manifest version MUST be restorable. Rollback is itself a versioned event: restoring version *X* produces a *new* version whose content equals *X*, appended to `versionHistory` — history is append-only and is never rewritten or truncated. For auto-accepted changes, one-tap rollback MUST be available directly from the acceptance notification. Rollback does not delete Adaptation State, but pending proposals based on a rolled-back version MUST be re-based or withdrawn (Section 3.6). Rollback of a subscription-related change also restores the previously effective subscribed version or pin.

## 8. History Inspection

The complete history of a Lens Manifest MUST be inspectable on-device: every retained version retrievable as a full manifest snapshot, and any two versions diffable, producing a Lens Diff (`comparison: "self-over-time"`) rendered with human-readable summaries. Inspection and diffing MUST NOT require network access. Because snapshots are history-free manifest cores ([ADR-0006](../adr/0006-history-free-shareable-core.md)), retaining and even exporting them is safe by construction; `versionHistory` itself contains only version identifiers, hashes, dates, and proposal identifiers, never reading history. Engines MUST retain, at minimum, every version still referenced by `versionHistory`, and SHOULD retain all versions absent explicit user deletion.

## 9. References

- [Lens Engine Specification](./lens-engine.md); [Lens Manifest Specification](./lens-manifest.md); [Lens Diff Specification](./lens-diff.md); [Privacy Model](../security/privacy-model.md); [Roadmap](../docs/roadmap.md).
- JSON Schemas: [`lens-manifest.schema.json`](../schemas/lens-manifest.schema.json), [`lens-diff.schema.json`](../schemas/lens-diff.schema.json).
- [ADR-0004](../adr/0004-reproducibility-envelope.md), [ADR-0006](../adr/0006-history-free-shareable-core.md), [ADR-0010](../adr/0010-adaptation-policies-parameterized.md).
- BCP 14: [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174).
