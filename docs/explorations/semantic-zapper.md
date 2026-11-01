# Exploration: a semantic zapper engine

**Status:** Exploration · **Date:** 2026-11-01 · **License:** CC-BY 4.0

*This document is informative and non-binding. It explores an alternative Lens Engine concept, records where it meets and where it breaks the published specification, and sketches a spike that would test it. It proposes no change to any ADR, specification, schema, or the constitution, and it does not use BCP 14 normative keywords except inside quotations. If any route described here is pursued, it enters the project through the processes in [GOVERNANCE.md](../../GOVERNANCE.md) Sections 3 and 4, not through this document.*

## 1. The concept in one paragraph

A small, fast decision model runs on the reader's device. When a page renders, the engine segments it into blocks (paragraphs, cards, list items, sidebars, comment threads), asks the model how well each block matches the reader's Lens Manifest priorities, and hides the blocks that fall below a confidence threshold, in the manner of uBlock Origin's element zapper. The reader adjusts that threshold and their interest weights with sliders, can flip between a before and an after view of the page, and has their slider positions remembered as they browse.

The concept is attractive, and the parts that do not fit are worth stating precisely. **As described, it is not a conforming Lens Engine**: hiding content the model scores low is exactly what four normative statements and one rule-based-floor requirement prohibit (Section 4). Three routes remain open, with very different costs (Section 5). The reader controls the request asks for (sliders, before/after, saved interests) map onto the existing protocol cleanly, with two traps around history leakage (Section 6).

## 2. Where the idea comes from

### 2.1 HackerTube

Andrej Karpathy's [HackerTube](https://karpathy.bearblog.dev/hacker-tube/) (2026) is a YouTube-style front end over videos that Hacker News commenters recommended. As the post describes it, one model filtered the full Hacker News comment corpus to roughly 40,000 comments recommending a video, a second model removed spam and low-quality items, and the result is a catalogue of 6,454 videos across 150 topics, with "For You" recommendations kept in browser session state rather than an account. The figures are the author's own account.

The motivation is the same one in LensPub's [problem statement](../problem-statement.md): a platform's feed, tuned for the median user, "definitely does not work for me." The construction is different in a way that matters for this document. HackerTube's filtering happens *upstream*, before the reader sees anything: it decides what exists in the catalogue. In this project's vocabulary that is curation of a Record Set ([ADR-0011](../../adr/0011-overlay-invariants-bind-to-authored-content.md), Proposed), and selection of what the reader sees is the thing the [protocol's non-goals](../../spec/lenspub-protocol.md#11-non-goals) rule out. The zapper concept moves the same impulse *downstream*, onto pages the reader already chose to open. That is closer to LensPub's territory, which is why the collision with its invariants is direct rather than incidental.

### 2.2 The element zapper

uBlock Origin's element zapper removes a clicked element from the current page, temporarily; its element picker turns a selection into a persistent cosmetic filter (a CSS selector scoped to a site) that hides matching elements on every later visit. Two properties carry over to this concept and one does not. Carried over: hiding is a style change (`display: none`), not a DOM rewrite, so it is cheap and reversible; and cosmetic filters are a mature, readable selector syntax. Not carried over: in uBlock Origin the *user* chooses every zap. Here a model chooses, which is the whole difference.

## 3. The models named

Both models named in the request exist; both are recent, and most performance figures below come from their vendors.

**Jev** is a "System One" decision model from TypeSafe AI, introduced in September 2026 ([Jev AI explainer](https://jevai.net/articles/what-is-system-one-jev/), [DigitalOcean overview](https://www.digitalocean.com/resources/articles/what-is-jev), [MindStudio overview](https://www.mindstudio.ai/blog/jev-system-one-model-launch)). Instead of generating text it evaluates a fixed decision space in one pass and returns typed results with a probability: a choice among named options, a score against a rubric, or a 0–1 value for a binary proposition. TypeSafe positions it for classification, guardrails, routing, and high-volume judgments, trained for calibration; its own comparison claims roughly two orders of magnitude lower latency than a general LLM on such tasks. **Jev is available only as a hosted API.**

**Clef** and **Clef-flash** are Cloudflare's open-weight answer to Jev, released 1 October 2026 under Apache-2.0 ([DataNorth](https://datanorth.ai/news/cloudflare-releases-clef-and-clef-flash), [Towards AI](https://pub.towardsai.net/what-is-clef-the-cloudflare-model-that-competes-with-jev-076995ab2bc7), [LLMRun hardware notes](https://llmrun.dev/model/cloudflare-clef)). Clef is 27B parameters, Clef-flash 9B; both accept the Jev request shape, take up to 64 questions per request, have a 64K context, and accept images alongside text. Cloudflare reports a 38.8 ms median decision latency for Clef-flash on its own edge GPUs, which says nothing about a laptop. Community GGUF builds exist for Clef; 4-bit Clef needs about 17 GB of memory, so on consumer hardware **Clef-flash is the realistic on-device candidate**, with its local memory footprint not yet published.

**Why "decision model" is the right shape.** The question this engine asks of every block is not "write something" but "how well does this match priority *p*?" across a few topics at once. A model that returns a calibrated probability per question, many questions per call, is a better fit than a chat model asked to emit JSON. Calibration also matters directly to the confidence slider (Section 6.1): a threshold only means something if a 0.7 means roughly the same thing from page to page.

**Fit with local-only inference.** [ADR-0005](../../adr/0005-local-only-default.md) makes on-device inference the default and remote inference a per-domain, revocable opt-in. Jev, being hosted, could only ever run under that opt-in, and a zapper calls its model on *every block of every page*, which turns the opt-in into a stream of the reader's browsing to a third party, the surveillance dynamic ADR-0005 exists to prevent. Clef-flash with local weights fits the default. Running it locally from a browser extension needs a native host (for example a llama.cpp or Ollama process reached through native messaging); the [proof of concept](../../poc/README.md) currently makes no network requests at all, so this is a real change in its posture even when the host is local.

**Comparable alternatives if neither fits.** Lighter routes worth measuring against Clef-flash: a small text-embedding model run in the browser over WebGPU, scoring each block by similarity to each priority's `topic` text (fast, deterministic, uncalibrated); a browser's built-in on-device model where one is exposed; or a small instruction model under a WebLLM-class runtime. These are general categories, not endorsements; none has been benchmarked here.

## 4. Fit with the protocol

### 4.1 What fits

- **The manifest is unchanged.** Priorities with weights in [-1, 1], Domain Scopes, and source trust are exactly the inputs a zapper needs. The engine compiles them into decision-model questions and thresholds, which are engine-internal artifacts and never exchanged, as [ADR-0001](../../adr/0001-manifest-is-declarative-policy.md) and [Lens Manifest Section 1](../../spec/lens-manifest.md#1-introduction) already allow.
- **Capability tiers absorb it.** A Clef-flash engine is a `local-model` tier engine, or `hybrid` with the rule-based floor alongside ([Lens Engine Section 4.1](../../spec/lens-engine.md#41-tier-definitions)).
- **Reasoning traces are natural.** Every decision carries the priority it was scored against, the probability, and the threshold, which is a better trace than most generative engines can give ([ADR-0004](../../adr/0004-reproducibility-envelope.md)).

### 4.2 What does not

The core act, hiding blocks the model scores low, is prohibited in five places:

- [LensPub Protocol Section 6.2](../../spec/lenspub-protocol.md#62-apply-interpretation): on Apply, "the underlying content MUST NOT be rewritten, obscured by default, or reordered."
- [LensPub Protocol Section 7.3](../../spec/lenspub-protocol.md#73-unconditional-requirements), Requirement 1: "Implementations MUST NOT rewrite, remove, reorder, or obscure-by-default the underlying content." [Section 9](../../spec/lenspub-protocol.md#9-accessibility-requirements) extends this to the accessibility tree, and `display: none` removes a node from it.
- [Lens Engine Section 6.1](../../spec/lens-engine.md#61-non-interference): "LensPub is not a content filter."
- [Lens Engine Section 4.2](../../spec/lens-engine.md#42-the-rule-based-floor): negative weights "MUST NOT hide, collapse, or filter content."
- The [Glossary](../../GLOSSARY.md) entry for Overlay Annotation.

Behind all five sits the constitution's [Non-Goals](../../constitution/DESIGN_HANDOFF.md#non-goals), where the first two items are "a truth engine" and "censorship software," and [ADR-0007](../../adr/0007-epistemic-stance.md)'s line between ranking *interpretations* and ranking *content*. A model that decides which paragraphs of a page the reader sees is on the far side of that line. The pages a reader would most want filtered are also the ones where a hidden counterpoint or an unwelcome correction does the most damage, which is the filter-bubble failure LensPub was written against.

[ADR-0011](../../adr/0011-overlay-invariants-bind-to-authored-content.md) does not help, whatever its outcome. It concerns *order* over a Record Set with no authored presentation, and it adds a completeness obligation that forbids filtering. A web page is Authored Rendered Content, the substrate on which every invariant binds unchanged.

## 5. Three routes

### 5.1 Route A — conformant today: the relevance veil

Keep everything except the default hide. The model's scores drive overlays only:

- **Above threshold:** `highlight` annotations, as the rule-based floor already does lexically.
- **Below threshold:** a quiet margin marker and a lowered overlay prominence, with the content left fully legible. The marker groups consecutive low-scoring blocks ("6 blocks below your lens") so the reader can skim past them.
- **Focus, on request:** a per-page action the reader invokes, which collapses the low-scoring blocks behind visible, labelled placeholders until the page is left. Nothing collapses until the reader asks, on that page.

The first two bullets are plainly conformant. The third is arguable: a collapse the reader asks for, each time, is not "by default" in the ordinary sense, and browser reader modes are precedent that user-invoked simplification is accepted practice. But "by default" is undefined in v0.1, and two implementers could read it differently, so it is the kind of question [GOVERNANCE.md Section 4](../../GOVERNANCE.md) routes to an issue before anything relies on it. A focus mode that turns itself on, or that the reader can set to "always," is not arguable; it is a default hide.

### 5.2 Route B — a sibling product that consumes manifests

The manifest is an open format, and nothing stops a separate tool from reading a Lens Manifest and filtering pages with it. Such a tool is not a Lens Engine and cannot claim conformance, and [GOVERNANCE.md Section 5](../../GOVERNANCE.md) obliges this project to say so rather than blur it. This route is cheap and honest, and it gives the zapper idea a place to live without bending the protocol. Its cost is that the reader's lens now drives a filter, a use LensPub's own documents say a lens is not for.

### 5.3 Route C — change the protocol

Make a reader-controlled filtering mode first-class. This is not a small change. It would contradict a constitutional Non-Goal and ADR-0007's stance, so it needs a constitutional amendment as well as a new ADR, under [GOVERNANCE.md Section 3](../../GOVERNANCE.md): a written proposal, at least 14 days of public review, and a recorded decision, with the dependent specification edits following only after acceptance.

If anyone writes that proposal, ADR-0011 shows the shape it would need: replace a prohibition with obligations that are at least as hard to violate silently, and are checkable. Candidates:

1. **A zap ledger with a completeness check.** Every hidden block is listed, with its trace, in a ledger the reader can open; the count of hidden blocks is always visible on the page; and a conformance check can verify that the hidden set equals the ledger, the same way the [spike](../../spike/README.md) verifies record completeness.
2. **One-action restore**, per block and for the whole page, without a reload ([Lens Engine Section 6.3](../../spec/lens-engine.md#63-layering-and-dismissal) already requires per-page disable).
3. **Never from a subscription.** A subscribed lens can never turn filtering on, consistent with the precedence rule that the user's own settings always win.
4. **Evidence-class content is exempt.** A block the engine itself would mark as a counterpoint, correction, or primary source is never hidden.
5. **Accessibility parity.** Hidden blocks remain reachable from the ledger by keyboard and assistive technology.

This document's view is that Route A should be tried before Route C is proposed. If the relevance veil plus on-request focus delivers most of the value, the constitutional change is unnecessary.

## 6. The reader controls

### 6.1 Confidence slider

A threshold on the model's probability is a compiled artifact: [Lens Manifest Section 1](../../spec/lens-manifest.md#1-introduction) lists "classifier thresholds" among the things an engine derives and never exchanges. It also does not travel: 0.7 from Clef-flash and 0.7 from an embedding model mean different things. The [view-selection argument](../../spec/lens-manifest.md#56-interpretation-required) applies one layer down: a portable-looking number whose meaning is fixed by one model is the defect ADR-0001 excludes. So the slider belongs in **engine-local settings**, not the manifest. Each result's Reproducibility Envelope records the model, quantization, and threshold in force, so a result can still be explained after the slider moves.

If a portable expression is wanted later, it should be in model-free terms ("show me fewer, stronger matches") under `extensions`, accepting that a change there is classed `major` and is never auto-accepted (Lens Manifest Section 5.12).

### 6.2 Before and after

This is the cheapest and most valuable control, and every route above needs it. Because hiding is a style change, "before" is the untouched page; an engine switches the overlay stylesheet off, or shows the two side by side, or offers hold-to-peek. It is the visual form of the obligation proposed in ADR-0011 (still under review) to "make the input order available": the reader can always see what the lens did. Under Route A it shows highlights and markers on and off; under Routes B and C it is the main defense against false zaps.

### 6.3 Interest sliders saved as you browse

An interest slider is a priority `weight`. Moving one is a `manual-edit` in the [Adaptation Model](../../spec/adaptation-model.md#31-observe): it takes effect immediately as a new manifest version, is allowed even under the Locked policy, and counts as evidence. That works as written. Two traps:

- **Saving per site writes history into the manifest.** "Remember my sliders on this site" stores a hostname next to a preference, and the manifest must never contain URLs visited ([Lens Manifest Section 3](../../spec/lens-manifest.md#3-the-history-free-rule), [ADR-0006](../../adr/0006-history-free-shareable-core.md)). Per-site positions belong in Adaptation State, which is device-local and never published. Preferences that should travel are expressed by topic, through Domain Scopes the reader names, not by the sites they happened to be on.
- **Many small versions form a timeline.** Each slider movement while browsing produces a dated version in `versionHistory`. A dense run of dated versions raising a "health" weight is a reading timeline in all but name. Commit on release rather than on drag, batch a browsing session's changes into one version the reader confirms, and omit or coarsen the optional `date`.

One more point. If the engine learns from what the reader restores or re-hides, that is only legitimate through an explicit affordance mapped to a defined feedback event (`reject-annotation`, `request-more-of-topic`). Inferring interest from which blocks the reader un-zaps or lingers on is an implicit signal, which v0.1 forbids from driving adaptation.

## 7. Risks

- **False zaps are worse than false highlights.** A wrong highlight costs a glance; a wrong hide costs content the reader never knows existed. The error is asymmetric, so thresholds should start conservative and the count of hidden blocks should always be on screen.
- **Latency and layout.** A long article or feed page has hundreds of blocks. At 64 questions per call, a page is several calls; on a laptop, Clef-flash latency is unmeasured. Hiding after render causes visible reflow, and hiding before render means delaying the page. Caching decisions by block-content hash, scoring visible blocks first, and re-scoring on DOM mutation for infinite scroll all need measurement.
- **Prompt injection through page text.** The model reads page content, and a page can contain text written to get itself kept, or to get a competitor's block hidden. Decision models narrow the output space, but they do not remove the attack. This belongs in the [threat model](../../security/threat-model.md) for any model-tier engine, and a filtering engine raises its stakes.
- **Breakage.** Hiding containers breaks layouts, and a model has no idea that a block is a cookie-consent control, a paywall notice, or a legal disclosure. A non-content allowlist (forms, dialogs, navigation landmarks) would be required.
- **Accessibility.** `display: none` removes content from the accessibility tree. Anything short of Route A must keep hidden content reachable.
- **Privacy.** A hosted decision model sees every block of every page. Only local inference is compatible with the default.
- **Reproducibility.** The same page, manifest, and slider can produce different hides across model versions and quantizations; the envelope must record all three.
- **Scope creep toward a recommender.** Hiding what does not match the reader's interests is, functionally, a personalized feed applied to a page. That is the outcome the project's [vision](../vision.md) names as the one to avoid, and it is the strongest argument for Route A.

## 8. A possible spike

A throwaway spike under `spike/`, clearly labelled non-conformant where it is (as the [existing spike](../../spike/README.md) is), answering three questions with numbers:

1. **Is it fast enough?** Score a fixed set of bundled pages with Clef-flash at 4-bit through a local native host, and with an in-browser embedding baseline. Report time to first decision, time to full page, and memory use.
2. **Is it accurate enough?** Hand-label the blocks of the fixture pages against a sample manifest, and report false-hide and false-keep rates at several thresholds, plus how stable those rates are across pages (a test of calibration).
3. **Does the interface work?** Build the ledger, the visible hidden-count, the before/after toggle, the confidence slider, and per-block restore on the fixture pages, and run a ledger-completeness check after every render, failing visibly if any hidden block is missing from the ledger.

The spike would bundle its fixtures and make no requests beyond the local model host, and it would not touch `poc/engine/` or the conformance suite. What would end the idea: a false-hide rate the reader would not accept at any threshold that still hides meaningful content, or a page latency that makes the "after" view arrive noticeably later than the page itself.

## 9. Open questions

- What does "by default" mean in Protocol Section 7.3? Is a collapse the reader invokes on a page, each time, conformant? This is the question to raise as an issue first, because Route A's third bullet depends on it.
- Is page chrome (ad slots, "related articles" rails, comment sections) "underlying content"? The specification does not distinguish it from the article, and a zapper aimed only at chrome is a smaller, different proposal.
- Is a decision model's calibration stable enough across sites for a single slider to mean anything? Only the spike can say.

## 10. References

- Karpathy, A. [HackerTube](https://karpathy.bearblog.dev/hacker-tube/). 2026.
- TypeSafe AI, Jev: [Jev AI explainer](https://jevai.net/articles/what-is-system-one-jev/) (unofficial community site), [DigitalOcean overview](https://www.digitalocean.com/resources/articles/what-is-jev).
- Cloudflare, Clef and Clef-flash: [DataNorth release summary](https://datanorth.ai/news/cloudflare-releases-clef-and-clef-flash), [Towards AI overview](https://pub.towardsai.net/what-is-clef-the-cloudflare-model-that-competes-with-jev-076995ab2bc7), [LLMRun hardware notes](https://llmrun.dev/model/cloudflare-clef).
- [uBlock Origin](https://github.com/gorhill/uBlock), element zapper and element picker.
- In this repository: [ADR-0001](../../adr/0001-manifest-is-declarative-policy.md), [ADR-0004](../../adr/0004-reproducibility-envelope.md), [ADR-0005](../../adr/0005-local-only-default.md), [ADR-0006](../../adr/0006-history-free-shareable-core.md), [ADR-0007](../../adr/0007-epistemic-stance.md), [ADR-0008](../../adr/0008-interpretation-is-overlay-stage.md), [ADR-0011](../../adr/0011-overlay-invariants-bind-to-authored-content.md) (Proposed), [LensPub Protocol](../../spec/lenspub-protocol.md), [Lens Engine](../../spec/lens-engine.md), [Lens Manifest](../../spec/lens-manifest.md), [Adaptation Model](../../spec/adaptation-model.md), [GOVERNANCE.md](../../GOVERNANCE.md).
