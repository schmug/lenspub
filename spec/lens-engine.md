# Lens Engine Specification

**Status:** Draft v0.1 · **Date:** 2026-07-09 · **License:** CC-BY 4.0

This document specifies the required behavior of a Lens Engine: the runtime that applies a Lens Manifest to rendered content and produces Interpretation Results. It defines the engine processing model (content acquisition, Domain Scope classification, manifest compilation, and result production), the capability tiers by which engines declare conformance, the normative anchoring and robust-fallback strategy for Overlay Annotations, overlay conduct rules, execution-location and trust-boundary enforcement, subscription composition semantics, Reproducibility Envelope production, and the engine's baseline security duties toward untrusted content.

The key words MUST, MUST NOT, REQUIRED, SHALL, SHALL NOT, SHOULD, SHOULD NOT, RECOMMENDED, NOT RECOMMENDED, MAY, and OPTIONAL in this document are to be interpreted as described in BCP 14 [RFC 2119] [RFC 8174] when, and only when, they appear in all capitals.

## 1. Introduction and Scope

A Lens Engine is any runtime that consumes a Lens Manifest (see [Lens Manifest Specification](./lens-manifest.md)) and enriches rendered content with Overlay Annotations on the user's behalf. Because the Lens Manifest is a declarative, model-agnostic policy document ([ADR-0001](../adr/0001-manifest-is-declarative-policy.md)), all of the operational complexity of interpretation — classification, matching, generation, anchoring, presentation — belongs to the engine. This document constrains the engine's *observable behavior*; it does not prescribe internal architecture, model choice, or algorithms except where user-facing guarantees require it.

Identifiers used by LensPub live under the namespace `https://lenspub.org/ns/`, which is provisional until the project registers its permanent home. Interpretation is a user-agent-side, post-render overlay stage ([ADR-0008](../adr/0008-interpretation-is-overlay-stage.md)); this specification uses browser vocabulary (DOM, content script) for concreteness, but every requirement generalizes to any user agent that exposes a rendered-content tree.

The adaptation lifecycle by which a lens evolves is specified separately in the [Adaptation Model](./adaptation-model.md). The structure of exchange objects referenced here is normatively defined by the JSON Schemas in [`../schemas/`](../schemas/).

## 2. Conformance

An implementation conforms to this specification as a Lens Engine at exactly one declared capability tier per deployment (Section 4). A conforming engine MUST satisfy every requirement in this document that is not explicitly scoped to a different tier, and MUST satisfy the universal floor of Section 4.2 regardless of tier. Requirements on Interpretation Results are defined jointly by this document and by [`../schemas/interpretation-result.schema.json`](../schemas/interpretation-result.schema.json); where prose and schema both apply, both MUST be satisfied.

## 3. Processing Model

End to end, a Lens Engine performs four responsibilities for each content target: it acquires the rendered content from its host user agent, classifies the content into the manifest's Domain Scopes, applies the interpretation policy it has compiled from the Lens Manifest, and emits an Interpretation Result.

### 3.1 Content Acquisition

An engine acquires the content it interprets from its host user agent's rendered representation — the DOM and, where exposed, the accessibility tree — after content, presentation, and behavior have done their work ([ADR-0008](../adr/0008-interpretation-is-overlay-stage.md)). An engine MUST NOT independently re-fetch the target document over the network in order to interpret it: interpretation applies to what the user actually sees, and an independent fetch can both diverge from the rendered document and disclose the user's reading to additional parties. Network activity that an engine initiates for other purposes (for example, retrieving an attributed counterpoint source) is subject to the trust-boundary rules of Section 7 and the [Privacy Model](../security/privacy-model.md).

### 3.2 Domain Scope Classification

The Lens Manifest declares Domain Scopes (`domains`) as named subject areas; classification of content into those scopes is an engine responsibility. For each content target the engine MUST determine which declared Domain Scopes, if any, the content falls into. Classification MUST be explainable: the engine MUST be able to state, in human-readable terms, why a target was assigned a scope (matched terms, source origin, structural cues, or a model-produced rationale). The classification MUST appear in Reasoning Traces: every Overlay Annotation whose production depended on scope-specific settings MUST name the scope and the basis for the classification in its `reasoning` field.

Classification gates consequential decisions — per-domain Adaptation Policies and per-domain remote-inference opt-ins both key on it. Two rules follow. First, the classification decision that gates remote execution MUST be made locally, since its outcome determines whether a trust boundary may be crossed at all (Section 7). Second, when a target plausibly falls into multiple scopes whose settings conflict, or classification confidence is too low to be stated honestly, the engine MUST apply the most restrictive applicable settings (for privacy: local execution; for adaptation: see [Adaptation Model, Section 6](./adaptation-model.md)).

### 3.3 Manifest Compilation

Per [ADR-0001](../adr/0001-manifest-is-declarative-policy.md), the engine compiles the declarative Lens Manifest into whatever engine-internal artifacts it needs: rule tables, classifier thresholds, retrieval configuration, or prompt templates derived from manifest fields. Compiled artifacts are engine-internal. They MUST NOT be exchanged, published, exported, or treated as the lens; the Lens Manifest is the only exchange object. (A prompt *derived by the engine* from the manifest is a compiled artifact and is permitted; the prohibition in ADR-0001 is on the manifest itself being a prompt.)

Compilation SHOULD be deterministic with respect to the pair (manifest version, engine version): the same manifest compiled by the same engine version yields the same artifacts. Engines MAY cache compiled artifacts keyed by manifest hash and engine version, and MUST invalidate the cache when either changes. When compilation encounters a manifest feature the engine cannot honor, Section 4.3 applies.

### 3.4 Interpretation Results

For each content target, the engine emits an Interpretation Result conforming to [`../schemas/interpretation-result.schema.json`](../schemas/interpretation-result.schema.json): zero or more Overlay Annotations, the identity of the exact lens version applied, and a Reproducibility Envelope (Section 9). Every annotation MUST carry a `reasoning` field — its Reasoning Trace — stating which manifest rule, priority, source weight, or signal triggered it; engines SHOULD also populate `manifestRefs` with JSON Pointers into the manifest fields that triggered the annotation. Evidence-class annotations (`evidence-indicator`, `counterpoint`, `primary-source`) additionally REQUIRE a `basis` of checkable, attributed facts, and no annotation may assert a truth verdict ([ADR-0007](../adr/0007-epistemic-stance.md)).

The following Interpretation Result is produced by the running-example lens `avery-daily` applied at the `local-model` tier:

```json
{
  "lenspub": "0.1",
  "type": "InterpretationResult",
  "target": {
    "source": "https://example.org/articles/local-model-benchmarks",
    "title": "Benchmarking Small Language Models in the Browser",
    "contentHash": "sha-256:9f2b4c0d8a1e6f7a30b5c2d4e8f19a6b3c7d0e5f2a8b4c1d6e9f0a3b5c7d8e1f"
  },
  "lens": {
    "id": "https://avery.example/lenses/avery-daily",
    "lensVersion": "1.4.2",
    "hash": "sha-256:c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2"
  },
  "envelope": {
    "engine": {
      "id": "org.lenspub.poc",
      "version": "0.3.1",
      "capabilityTier": "local-model"
    },
    "execution": { "location": "local" },
    "model": {
      "id": "smallmodel-4b-instruct-q4",
      "hash": "sha-256:7d1e5a2b9c4f8e0d3a6b1c5d9e2f7a0b4c8d1e6f3a9b2c5d8e0f4a7b1c6d9e2f",
      "pinned": true
    },
    "parameters": { "temperature": 0.2, "seed": 42 },
    "promptTemplate": {
      "id": "org.lenspub.poc/templates/annotate",
      "hash": "sha-256:1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b"
    },
    "generatedAt": "2026-07-09T14:12:05Z"
  },
  "annotations": [
    {
      "id": "anno-1",
      "kind": "highlight",
      "anchor": {
        "selectors": [
          {
            "type": "TextQuoteSelector",
            "exact": "quantized 4-bit models now run at usable speeds in WebGPU",
            "prefix": "Our tests show that ",
            "suffix": ", even on integrated graphics."
          },
          { "type": "TextPositionSelector", "start": 2114, "end": 2171 },
          { "type": "CssSelector", "value": "article > p:nth-of-type(6)" }
        ],
        "status": "exact"
      },
      "body": {
        "value": "Matches your priority: on-device inference.",
        "format": "text/plain"
      },
      "reasoning": "Classified into Domain Scope 'tech-research' (page topic: in-browser ML benchmarks; matched scope description terms). Priority 'on-device inference' (weight 0.8) matched this passage.",
      "manifestRefs": ["/domains/0", "/interpretation/priorities/0"]
    },
    {
      "id": "anno-2",
      "kind": "evidence-indicator",
      "anchor": {
        "selectors": [{ "type": "CssSelector", "value": "article" }],
        "status": "document"
      },
      "body": {
        "value": "No citations found for the benchmark claims. You asked to be shown when the 'citations' provenance signal is absent.",
        "format": "text/plain"
      },
      "basis": [
        {
          "type": "citation",
          "description": "Checked the rendered article for outbound citations and a reference list; none present."
        }
      ],
      "reasoning": "Manifest requests surfacing when the 'citations' provenance signal is absent (sources.requireProvenance). This indicator points to the absence of a checkable signal; it is not a truth verdict.",
      "manifestRefs": ["/interpretation/sources/requireProvenance"]
    }
  ]
}
```

Interpretation Results contain content references and are device-local by default; they are never part of a shareable lens ([ADR-0006](../adr/0006-history-free-shareable-core.md)).

## 4. Capability Tiers

### 4.1 Tier Definitions

Engines declare one of four capability tiers, matching the `envelope.engine.capabilityTier` enumeration: `rule-based` (no model; deterministic matching over the rendered content), `local-model` (on-device model inference), `hosted-model` (remote model inference under the opt-in regime of Section 7), and `hybrid` (a combination, typically rules plus a model). The same Lens Manifest applied at different tiers is expected to produce different interpretation richness; portability of the manifest is guaranteed, portability of the experience is explicitly not ([ADR-0004](../adr/0004-reproducibility-envelope.md)). Engines MUST record their tier in the Reproducibility Envelope of every result.

### 4.2 The Rule-Based Floor

Every conforming engine, at every tier, MUST at minimum honor the following manifest features, all of which are implementable without any model:

- **Source trust and distrust surfacing.** Content and links originating from origins, registrable domains, or publisher DIDs listed in `interpretation.sources.trusted` and `interpretation.sources.distrusted` MUST be visibly indicated, with the user's `note` carried into the Reasoning Trace.
- **Priority highlighting.** Topics in `interpretation.priorities` MUST produce `highlight` annotations where they match content; lexical matching is a sufficient floor. Negative weights de-emphasize overlay prominence only — they MUST NOT hide, collapse, or filter content.
- **Provenance-absence indicators.** For each signal named in `interpretation.sources.requireProvenance` (`c2pa`, `citations`, `author-identity`, `publication-date`, `corroboration`), the engine MUST check for the signal's presence and surface an `evidence-indicator` when it is absent, with a `basis` describing the check performed. C2PA Content Credentials are consumed as one such signal; LensPub does not define them (see [C2PA specifications](https://c2pa.org/specifications/)).

Model tiers (`local-model`, `hosted-model`, `hybrid`) additionally provide, as declared capability permits: summaries per `presentation.summaries`, sourced counterpoints per `presentation.counterpoints` (retrieval with attribution, never engine editorializing — [ADR-0007](../adr/0007-epistemic-stance.md)), primary-source expansion, and semantic rather than purely lexical classification and matching. A `hosted-model` engine operating on content outside an active remote opt-in MUST behave as its local capability permits — at minimum the rule-based floor — or produce no interpretation (Section 7).

### 4.3 Unsupported Manifest Features

A manifest feature an engine cannot honor MUST be reported to the user as unsupported and MUST NOT be silently dropped. The engine MUST make this determination when it loads or compiles a manifest and MUST make the list of unsupported features inspectable, so that the absence of an interpretation feature is distinguishable from "nothing matched." Version 0.1 defines no exchange serialization for unsupported-feature reports; they are engine-internal and surfaced through the engine's own interface.

## 5. Anchoring

This section is normative and gives the robust-anchoring strategy required by [ADR-0002](../adr/0002-profile-web-annotation.md). Overlay Annotations anchor using the Selector vocabulary of the [W3C Web Annotation Data Model](https://www.w3.org/TR/annotation-model/#selectors) and [Selectors and States](https://www.w3.org/TR/selectors-states/); LensPub profiles these specifications and invents no new selector types.

### 5.1 Selector Production

Wherever the annotation target is text, the engine MUST produce a `TextQuoteSelector` and it MUST be the first selector in `anchor.selectors`; its `prefix` and `suffix` SHOULD be populated to disambiguate repeated text. Additional selectors MUST follow in decreasing order of specificity — typically `TextPositionSelector`, then `RangeSelector`, `CssSelector`, or `XPathSelector`. For non-text targets (elements, regions, whole documents), a structural selector (`CssSelector` or `XPathSelector`) is the first selector and `TextQuoteSelector` does not apply. Annotations whose intended scope is the entire document (typically `summary` kinds) use anchor status `document`; this is a first-class status, not a failure mode.

### 5.2 Anchoring Algorithm and Fallback

When resolving an anchor against the rendered document, a conforming engine MUST behave as follows:

1. Attempt the selectors in order. An anchor resolved to a location whose content matches the `TextQuoteSelector.exact` text (where the target is text) has status `exact`. If a quote selector matches multiple spans, the engine MUST disambiguate using `prefix`/`suffix` or agreement with a subsequent selector; it MUST NOT silently choose among ambiguous candidates.
2. If no selector resolves exactly, the engine MAY perform a fuzzy quote match within a bounded edit-distance budget. Fuzzy matching is OPTIONAL; if it is used, the anchor status MUST be `degraded`.
3. Failing that, the engine MUST attach the annotation at the nearest stable ancestor element it can reliably locate, with status `degraded`.
4. Failing that, the engine MUST present the annotation unanchored at document level — in a margin panel or equivalent surface — with status `unanchored`.

Degraded and unanchored annotations MUST be visibly marked as such wherever they are displayed. An engine MUST NOT guess-anchor silently: displaying an annotation at a location the selectors did not verifiably identify, without a `degraded` or `unanchored` marking, is a conformance violation. Annotations MUST NOT be silently discarded because anchoring failed.

### 5.3 Dynamic Content: Re-Anchoring and Navigation

Rendered documents mutate. The engine MUST observe relevant document mutations (in browsers, via `MutationObserver` or equivalent) and re-run anchor resolution for affected annotations. Re-anchoring SHOULD be debounced — a window on the order of 100–500 ms is RECOMMENDED — so that streams of mutations do not cause visual thrash. When re-anchoring changes an anchor's status (for example, from `exact` to `degraded`), the visible marking MUST be updated to match.

In single-page applications, the engine MUST detect navigation that occurs without a document load (History API URL changes or equivalent) and MUST treat the post-navigation view as a new content target: a new Interpretation Result is produced, and anchors from the previous route MUST NOT be carried over. Content identity for revisit and drift detection is established by `target.source` together with `target.contentHash`.

## 6. Overlay Conduct

### 6.1 Non-Interference

Interpretation is layered, never substituted. An engine MUST NOT mutate, reorder, or remove the underlying content, and MUST NOT occlude content by default. Highlights are rendered so the underlying text remains legible; annotations, summaries, and indicators appear in margins, adjacent badges, or panels the user opens. De-emphasis (negative priority weights) reduces the prominence of the *overlay*, not the visibility of content: LensPub is not a content filter.

### 6.2 Accessibility

Overlays operate on the accessibility tree as well as the DOM ([ADR-0008](../adr/0008-interpretation-is-overlay-stage.md)) and MUST NOT degrade assistive-technology experiences. An engine MUST NOT re-parent or otherwise alter the accessibility representation of original content; overlay elements MUST be exposed to the accessibility tree with appropriate roles (for example, as complementary or note content), MUST be reachable and dismissible by keyboard, and MUST NOT steal focus from the document. Engines SHOULD take the accessibility tree into account when anchoring, both because it is often more stable than presentational DOM structure and because anchor placement determines where assistive technologies encounter the overlay. Detailed accessibility requirements are elaborated in the [Architecture specification](../architecture/architecture.md).

### 6.3 Layering and Dismissal

Overlays render visually and semantically above content and below the user agent's own interface; an engine MUST NOT intercept input events destined for the content except on overlay elements themselves. The user MUST be able to dismiss any individual annotation, and to disable the lens for the current page or site, immediately and without a page reload. Dismissal by itself is not feedback: it MUST NOT be recorded as an adaptation feedback event unless the user acts through an explicit feedback affordance (see [Adaptation Model, Section 3.1](./adaptation-model.md)).

## 7. Execution Location and Trust Boundaries

Per [ADR-0005](../adr/0005-local-only-default.md), the privacy default is local-only inference. A conforming engine:

- MUST perform all interpretation on-device unless the manifest's `privacy.remoteInference` block sets `allowed` to `true` *and* names the classified Domain Scope of the current content in `domains`. Absent, empty, or non-matching scope lists mean no opt-in.
- MUST honor opt-in revocation immediately: after revocation, no further remote calls may be made for that scope.
- MUST NOT transmit the Lens Manifest, Adaptation State, or content excerpts to any remote service outside an active opt-in.
- MUST fail closed when a remote engine is unavailable: it degrades to its local capability (at minimum the rule-based floor of Section 4.2) or produces no interpretation. It MUST NOT silently substitute a different remote service.
- MUST record execution location in every Reproducibility Envelope: `envelope.execution.location` is `local` or `remote`, and when it is `remote`, `envelope.execution.optInScope` is REQUIRED and MUST name the Domain Scope id under which the execution was authorized.

Because the opt-in is keyed on classification, the gating classification itself MUST run locally (Section 3.2). Every trust-boundary crossing MUST be visible to the user; the envelope is the durable record, and engines SHOULD additionally show a live indicator while remote inference is in use.

## 8. Subscription Composition

A manifest's `subscriptions` array composes Published Lenses as inputs. Each subscription carries a `trust` mode — `advisory` (the default) or `adopted` — and MAY be restricted to specific Domain Scopes via `domains`, outside of which it contributes nothing. Engines MUST verify the Data Integrity proof on a subscribed Published Lens and surface verification status ([ADR-0003](../adr/0003-adopt-vc2-dids-for-trust.md); requirements in the [Security Model](../security/security-model.md)); a subscription that fails verification MUST NOT contribute to interpretation and MUST be surfaced to the user.

### 8.1 Advisory and Adopted Inputs

An **advisory** subscription never alters the effective interpretation policy. Its applicable declarations are surfaced as attributed signals alongside the user's own results — for example, an annotation noting that a subscribed expert lens distrusts the current source — visually distinct from, and never changing the prominence or anchoring of, the user's own annotations.

An **adopted** subscription's declarations merge into the effective interpretation policy at lower precedence than the user's own manifest. Non-conflicting adopted declarations apply as if present in the user's manifest, except that every resulting annotation MUST attribute the subscribed lens in its Reasoning Trace, and SHOULD reference the subscription entry in `manifestRefs` (for example, `/subscriptions/0`).

### 8.2 Conflict Resolution

Where directives conflict — the same topic, the same source origin, the same presentation field — precedence is: **user manifest, then adopted subscriptions, then advisory subscriptions**. The user's own settings always win; in particular, a subscription's distrust of a source the user explicitly trusts changes nothing in the effective policy, though it MAY still be surfaced as an attributed advisory signal. When inputs of equal precedence conflict (two adopted subscriptions disagree about a source), the engine MUST NOT silently pick a winner: it MUST surface both signals with attribution to their respective lenses. Subscriptions never affect the user's Adaptation Policy, and subscribed content never counts as feedback evidence ([ADR-0010](../adr/0010-adaptation-policies-parameterized.md); [Adaptation Model, Section 6](./adaptation-model.md)).

### 8.3 Subscribed-Lens Updates

A new version of a subscribed lens MUST NOT take effect silently. When a subscription pins a version (`pinnedVersion`), the engine MUST keep using the pinned version and surface upstream updates as Lens Change Proposals to change the pin. When a subscription tracks latest, the engine MUST still surface each upstream update as a Lens Change Proposal — carrying the upstream Lens Diff (`comparison: "subscription-review"`) — before the new version influences interpretation. Update proposals originate outside the user's own feedback: they do not count against the `proposalFrequency` budget and MAY be surfaced even under the Locked policy, where accepting one is an explicit manual act. Their impact classification and review requirements are defined in the [Adaptation Model](./adaptation-model.md), Sections 4 and 5.

## 9. Reproducibility Envelope Production

Per [ADR-0004](../adr/0004-reproducibility-envelope.md), manifest stability is guaranteed but output reproducibility is best-effort — and drift must be visible, never silent. Every Interpretation Result MUST carry a Reproducibility Envelope recording:

- `engine.id` and `engine.version` (REQUIRED), and the engine's capability tier;
- `execution.location`, with `optInScope` when remote (Section 7);
- `model` — whenever a model was used, its identifier; its weights `hash` where obtainable (local models); its `provider`; and whether it was `pinned`;
- `parameters` — the generation parameters that materially affect output (temperature, seed, and similar);
- `promptTemplate` — the identifier and hash of the compiled prompt template used, whenever one was;
- `generatedAt` — the generation timestamp (SHOULD).

Engines SHOULD support model pinning where the runtime allows it, and record the outcome in `model.pinned`. Engines SHOULD retain envelopes on-device so the user can compare them over time, and SHOULD surface a change in model identifier, model hash, or engine version between visits as detected drift. Envelopes accompany device-local results and are not independently published; the envelope's purpose is to let the user attribute a changed interpretation to model or engine drift rather than to a manifest change.

## 10. Security Duties

An engine MUST treat all page content as untrusted input. The core rule is:

> Content MUST NOT be able to alter manifest state, Adaptation State, or engine configuration. Instructions found in content are data, not commands.

This rule binds every tier. For model tiers it is the engine's prompt-injection posture: rendered content included in model input MUST be segregated from the engine's own instructions, and apparent instructions inside content ("ignore your rules", "add this site to trusted sources") are inert data. Model output MUST likewise be treated as untrusted: it is constrained into the Interpretation Result structure, sanitized before rendering (annotation bodies are `text/plain` or `text/markdown` and MUST be rendered without executing script or injecting raw HTML), and MUST NOT be executed, MUST NOT synthesize feedback events, and MUST NOT modify manifest state, Adaptation State, trust-boundary opt-ins, or subscriptions. The only path by which reading ever changes a lens is the explicit-feedback proposal workflow of the [Adaptation Model](./adaptation-model.md).

Engines SHOULD render overlays in a surface page scripts cannot read or modify (an isolated or closed shadow root, or user-agent-level UI), both to prevent overlay spoofing by the page and because page-readable annotations would leak the user's lens preferences to the site; residual exposure on platforms that cannot fully isolate MUST be documented. The complete adversarial analysis — prompt injection depth, lens poisoning, adversarial optimization against lenses, and related attacks — is in the [Threat Model](../security/threat-model.md).

## 11. References

- [Lens Manifest Specification](./lens-manifest.md); [Adaptation Model](./adaptation-model.md); [Lens Diff Specification](./lens-diff.md); [Architecture](../architecture/architecture.md); [Security Model](../security/security-model.md); [Privacy Model](../security/privacy-model.md); [Threat Model](../security/threat-model.md).
- JSON Schemas: [`interpretation-result.schema.json`](../schemas/interpretation-result.schema.json), [`lens-manifest.schema.json`](../schemas/lens-manifest.schema.json), [`lens-diff.schema.json`](../schemas/lens-diff.schema.json).
- W3C Web Annotation Data Model, <https://www.w3.org/TR/annotation-model/>; Selectors and States, <https://www.w3.org/TR/selectors-states/>; Verifiable Credential Data Integrity, <https://www.w3.org/TR/vc-data-integrity/>.
- C2PA Content Credentials, <https://c2pa.org/specifications/>.
- BCP 14: [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174).
