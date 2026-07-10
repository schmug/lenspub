# The LensPub User Experience

This document describes what it is like to read, and to live, with a lens. It is a vision-level companion to the normative specifications: the object formats live in the [Lens Manifest](../spec/lens-manifest.md) and [Lens Diff](../spec/lens-diff.md) specifications, the runtime behavior in the [Lens Engine specification](../spec/lens-engine.md) and the [Adaptation Model](../spec/adaptation-model.md). Everything here is expressed in terms of those documents; nothing here introduces new protocol.

The running example is the browser — the reference implementation is a browser extension, and the browser sits naturally at the interpretation boundary — but the experience is deliberately device-agnostic. Interpretation is a user-agent-side, post-render overlay stage ([ADR-0008](../adr/0008-interpretation-is-overlay-stage.md)), and any user agent that exposes a rendered-content tree — an e-reader, a feed client, an operating-system agent — can host the same experience. Our example reader is Avery, a technologist whose lens is called `avery-daily`.

## Reading with a lens

Avery opens a news article about a newly announced machine-learning benchmark. The page is exactly the page the publisher shipped: same text, same layout, same order. What the lens adds sits visibly above it.

A few passages carry a quiet highlight — the sentences the lens judged most relevant to Avery's priorities, in this case the `model-evaluation` topic that `avery-daily` weights heavily in its tech-research Domain Scope. In the margin, small indicators mark paragraphs that have something attached: a summary, an evidence indicator, an available counterpoint. At the top of the article, a collapsed one-paragraph summary waits to be expanded; Avery's manifest asks for brief summaries, so that is what the Lens Engine produced, and a tap expands it or puts it away.

Beside a claim about the benchmark's results sits an evidence indicator. It is not a verdict. It says something checkable: *this claim cites the underlying paper*, or *no citation found for this figure*, or *this image carries C2PA Content Credentials*. Opening the indicator shows its basis — the actual attributed facts it points to: the citation link, the provenance credential, a corroborating report. Every evidence-class annotation carries such a basis by construction; the [Interpretation Result schema](../schemas/interpretation-result.schema.json) will not represent one without it. The lens surfaces provenance and signals; it never adjudicates truth ([ADR-0007](../adr/0007-epistemic-stance.md)).

Because Avery's manifest sets counterpoints to on-request, a margin indicator notes that a counterpoint exists, and only produces it when asked. What appears is an existing, attributed source — a named researcher's published critique of the benchmark's methodology, with a link — never the engine's own editorial rebuttal. Retrieval with attribution, not opinion. Similarly, where the article paraphrases the benchmark paper, a primary-source expansion offers the paper's own abstract and a link, because Avery's manifest asks for that.

Every one of these overlays answers the same question the same way. Attached to each is a small affordance — *why am I seeing this?* — that opens the annotation's Reasoning Trace: a plain sentence such as "Highlighted because your lens weights 'model-evaluation' at 0.7 in tech-research, and this passage reports evaluation methodology." Alongside the sentence, the trace links to the exact manifest fields that triggered the annotation — carried as `manifestRefs`, JSON Pointers into the Lens Manifest, rendered not as pointers but as the human-readable settings they name. If Avery wrote a rationale on that priority ("I keep getting burned by unreproducible benchmarks"), the trace can echo it back: the lens explains itself in Avery's own words. The distance between "why is this highlighted?" and the setting responsible is one tap, and from there, one more tap to change the setting.

## What never changes: the page

Two invariants anchor the whole experience.

First, content is never rewritten. Interpretation is layered above content, never substituted for it ([ADR-0008](../adr/0008-interpretation-is-overlay-stage.md)). The lens does not delete a paragraph, reorder a page, paraphrase an author, or hide content it scores low. Even de-emphasis — a negative priority weight — affects only the prominence of overlays, never the visibility of the underlying content. What the author published is what Avery sees; what the lens thinks is visibly *on top of* it, expressed as Overlay Annotations profiled on the [W3C Web Annotation Data Model](https://www.w3.org/TR/annotation-model/) ([ADR-0002](../adr/0002-profile-web-annotation.md)).

Second, every overlay is dismissible. Any single annotation can be waved away; the whole lens can be toggled off for a page, a site, or entirely, and the unadorned page remains. An interpretation layer that cannot be removed is just another intermediary; LensPub's overlays are a garment, not a graft.

## When anchoring fails

Web pages move. Text is edited, personalized, and re-rendered, and an annotation anchored to last week's sentence may not find it today. The Lens Engine attempts its anchors in order of specificity and degrades honestly rather than guessing. An annotation that could only attach approximately — at the nearest stable ancestor of its original target — is visibly marked as approximate. An annotation that could not attach at all is not discarded and not guessed into place: it appears in a margin panel of unanchored annotations, plainly labeled as having lost its anchor, with the text it originally referred to. Nothing is ever guess-anchored silently ([ADR-0002](../adr/0002-profile-web-annotation.md)). The reader can always distinguish "the lens knows exactly what this refers to" from "the lens is showing you something it can no longer place."

## When the lens asks to change

Avery's lens learns, but only out loud. Learning begins with explicit feedback — "more like this," "less of this," a dismissed annotation pattern, a pinned source — never with covert behavioral inference. That feedback accumulates as private, device-local Adaptation State, and when it crosses the evidence threshold set by Avery's Adaptation Policy, the Lens Engine drafts a Lens Change Proposal.

A proposal announces itself quietly — a badge on the lens icon, an entry in a review queue — at most as often as Avery's own policy allows. It never interrupts reading and it never takes effect merely by being shown. Opening it presents a review screen with a consistent anatomy:

- **A plain-language summary.** One or two sentences: "Your lens wants to raise emphasis on model evaluation in tech-research from 0.4 to 0.7."
- **A diff preview.** The exact change as a [Lens Diff](../spec/lens-diff.md) in `proposal-preview` mode — every affected field, its before and after values, each rendered as a readable sentence with its impact class.
- **Evidence counts.** What the proposal rests on: "based on 9 explicit feedback events since June 12." The underlying records live only on Avery's device and are inspectable there; they are never part of the lens itself.
- **A shadow comparison.** Where the engine has run the proposed lens in shadow, a side-by-side of a recent page interpreted under the current lens and under the proposed one — the difference shown, not described.
- **Three buttons.** Accept, reject, or modify. Modify opens the proposed values for direct editing before acceptance; Avery's hand is always the last one on the manifest.

Acceptance mints a new, immutable manifest version. Rejection leaves the lens untouched and teaches the engine not to re-raise the same proposal.

Under the more permissive policies — Adaptive and Explorer — changes of the lowest impact class may be auto-accepted, within the ceiling Avery's policy defines ([ADR-0010](../adr/0010-adaptation-policies-parameterized.md)). Auto-acceptance is never silence: a notification states what changed, in the same plain language, with a one-tap rollback attached. The distinction LensPub draws is not between manual and automatic; it is between changes the user has seen and changes the user has not. The second kind does not exist.

## Managing the lens

The lens itself has a home screen, and its centerpiece is a history timeline: every version of `avery-daily`, newest first, each entry naming its date, its version, and the accepted proposal or manual edit that produced it. Two gestures matter here.

Any version can be restored. Rollback is a first-class, single-action operation to any point in the lens's history — and it is itself recorded, so the timeline never lies about what Avery's lens was on a given day.

Any two versions can be compared. Selecting two points on the timeline opens a diff view — the same Lens Diff rendering used everywhere else: a plain-language change list ordered by impact, and a side-by-side view for readers who want to see the manifests themselves. The same view compares Avery's lens against a friend's exported lens or a Published Lens, and because manifests are history-free by construction ([ADR-0006](../adr/0006-history-free-shareable-core.md)), comparing lenses with another person is structurally incapable of exposing what either of them has read.

Alongside the timeline sit the policy dials: one row per Domain Scope, each with the five named presets — Locked, Conservative, Balanced, Adaptive, Explorer — plus the lens-wide default they override. Avery's configuration is typical: politics Locked, tech-research Adaptive, entertainment Explorer. The dial is not a metaphor for a hidden learning rate; each preset is a named point on three explicit parameters (proposal frequency, evidence threshold, auto-accept ceiling), and the screen shows those numbers to anyone who looks. Behind all of it, the manifest remains a readable JSON document; the management UI is a view over it, and a power user can always open the document itself.

## Subscribing to other people's lenses

Avery can browse Published Lenses — an accessibility expert's lens, a scientific-skepticism organization's lens, a partner lens shared within a reading group. A published lens's page shows three things before any commitment: who published it, what it contains, and what it cannot contain.

*Who*: the publisher's identity is a DID, and a Signed Manifest carries a Verifiable Credential Data Integrity proof ([ADR-0003](../adr/0003-adopt-vc2-dids-for-trust.md)). The engine verifies the proof and renders the result as a verification badge — verified publisher, unsigned, or failed verification, each visually distinct, with failure presented as a warning rather than a nuance. *What*: the manifest is inspectable in full before subscribing — its priorities, its trusted and distrusted sources, its presentation preferences, rendered readably. *What it cannot contain*: no browsing history, no reading record — not as a promise but as a structural property of the format.

Subscribing poses one deliberate choice: advisory or adopted. An advisory subscription lets the subscribed lens annotate and suggest — its influence visible and labeled as coming from that lens — without changing how Avery's own lens interprets. An adopted subscription composes the lens into Avery's interpretation as an input, with Avery's own settings always taking precedence. Either way, the subscription can be restricted to specific Domain Scopes, and unsubscribing — or revoking trust in the publisher entirely — takes effect immediately.

Subscriptions also respect the stability contract. Avery can pin a subscription to an exact version, freezing it regardless of what the publisher does. Left unpinned, the subscription tracks the publisher's releases — but an update never applies itself. It arrives as a proposal, with a `subscription-review` Lens Diff showing exactly what changed between the version Avery reviewed and the new one, through the same review screen as any other change. A subscribed lens is a relationship, not a delegation.

## Seeing the trust boundary

Somewhere constant in the interface lives a small indicator with exactly two states: **local** and **remote**. It answers the only question that matters about where interpretation runs: did anything leave this device?

By default the answer is no. Interpretation runs on-device, and the protocol works — at whatever richness local capability allows — with no network at all ([ADR-0005](../adr/0005-local-only-default.md)). If Avery wants a hosted model's richer interpretation, that is an explicit opt-in, and the opt-in is per Domain Scope: cloud assistance for tech-research, never for health or politics. The opt-in flow states plainly what will cross the Trust Boundary — the content of pages in that scope, sent to a named provider — and the choice is revocable at any moment from the same screen. Every Interpretation Result carries its Reproducibility Envelope, which records where it was executed and under which opted-in scope, so the local/remote indicator is not an assurance but a display of recorded fact, inspectable per page. If a remote engine is unavailable, the lens fails closed into local capability — reduced richness, never a silent substitution of some other service.

The same envelope makes model drift visible: it names the engine version and model that produced each result, so when a hosted provider changes models under Avery's feet, the change shows up in the envelope trail rather than passing as a mood ([ADR-0004](../adr/0004-reproducibility-envelope.md)).

## An overlay everyone can read

An interpretation layer that degrades assistive technology would betray its purpose. Overlays participate in the accessibility tree deliberately ([ADR-0008](../adr/0008-interpretation-is-overlay-stage.md)): a screen reader announces an annotation as an annotation attached to a passage, never as text spliced into the author's sentence. The full overlay experience — moving between annotations, expanding a summary, opening a reasoning trace, dismissing anything — is operable from the keyboard and from assistive technology, not only by pointer. Highlights are never the sole carrier of meaning (color-blind readers get structure, not just tint), contrast respects platform standards, motion is minimal and honors reduced-motion preferences, and the margin-panel presentation of unanchored annotations is itself a linear, screen-reader-friendly structure. The invariant beneath: applying a lens never makes the underlying page less accessible than it was without one.

## What the experience refuses to do

Some absences here are load-bearing, and worth stating as commitments.

**No truth badges.** Nothing in the interface says *true* or *false*, and no green check will ever mean "verified correct." Evidence indicators point to checkable, attributed facts; the judgment remains the reader's ([ADR-0007](../adr/0007-epistemic-stance.md)). The demand for "just tell me if it's true" is real, and LensPub deliberately declines it — channeling it instead into showing the reader what can actually be checked.

**No engagement mechanics.** The lens has no streak, no score, no daily goal, and no notification designed to bring Avery back. Proposal notifications are rate-limited by Avery's own Adaptation Policy — the user sets the ceiling on how often the system may ask for attention. A lens is infrastructure for reading, not a destination competing for it.

**No unexplained prominence.** Nothing is highlighted, summarized, surfaced, or de-emphasized without a Reasoning Trace connecting it to a manifest field Avery can read and change. An overlay that cannot answer "why am I seeing this?" does not ship. This — ownership of the criteria, inspectability of every decision, layering above content the reader already chose — is what separates a lens from a recommendation algorithm, which selects what you see by criteria you cannot open.

**No feed.** The lens never chooses what Avery reads. It interprets what Avery has already chosen, and stops there.

The browser is where this experience lands first, because the browser is where the interpretation boundary already lives. But the lens is Avery's, not the browser's: the same manifest, history, policies, and subscriptions travel to any conforming user agent — reduced or enriched by that agent's capability tier, never held hostage by it. The experience described here is not a product's feature set; it is what any implementation of a user-owned interpretation layer looks like when the [design principles](./design-principles.md) are taken literally.
