# Worked example: Avery reads The Example Journal

This directory contains the complete end-to-end example required by the project constitution: a page, a Lens Manifest, the resulting annotated overlay, and the engine's reasoning — every object real, every JSON file valid against the normative schemas in [`../../schemas/`](../../schemas/). If you have just read the top-level README and want to see LensPub run end to end on paper, start here.

| File | What it is |
|---|---|
| [`article.html`](article.html) | A self-contained article from the fictional publication *The Example Journal* |
| [`lens.json`](lens.json) | "Avery's Daily Lens", version 1.4.0 — the Lens Manifest applied to the article |
| [`interpretation-result.json`](interpretation-result.json) | The Interpretation Result a conforming rule-based Lens Engine produces |
| [`lens-diff.json`](lens-diff.json) | The Lens Diff between manifest versions 1.3.0 and 1.4.0 |

All hashes in these files are well-formed illustrative placeholders; a real engine computes them over the manifest core and the rendered text. Every `exact` string in the result is a verbatim substring of the article's visible text — the anchors genuinely resolve.

## The scenario

Avery is the repository's running example persona: a technologist whose lens, `avery-daily`, runs locally in the browser. On the morning of 9 July 2026, Avery opens an Example Journal article, "Districts Turn to Local AI as Classroom Tools Multiply." The page is ordinary HTML. The publisher has done nothing to accommodate LensPub, and needs to do nothing: interpretation is a user-agent-side, post-render overlay stage ([ADR-0008](../../adr/0008-interpretation-is-overlay-stage.md)), so the article renders exactly as its author intended before the lens contributes anything.

Avery's manifest says, in effect: emphasize local-first AI (weight 0.9) and student data privacy (weight 0.7); trust `example-journal.example` and distrust `contentmill.example`; tell me when citations are missing; keep summaries brief; hold counterpoints until I ask; and adapt cautiously — Balanced by default, Adaptive for technical research, Locked for politics. That is the whole input. It is a declarative policy document, not a prompt and not model weights ([ADR-0001](../../adr/0001-manifest-is-declarative-policy.md)).

## What the engine does

The engine in this example is `lenspub-poc` 0.1.0 at the **rule-based** capability tier: no model at all, only deterministic rules. The pipeline is the one defined in the [Lens Engine specification](../../spec/lens-engine.md):

1. **Classify.** The engine assigns the rendered page to the manifest's Domain Scopes. Keyword rules place this article in both `technical-research` and `education-policy`. Classification is an engine responsibility and must be explainable; the matched terms are reported inside the reasoning trace of `ann-1` so Avery can check them.
2. **Compile.** The manifest's declarative intent is compiled into engine-specific artifacts — here, term lists and thresholds; at a model tier, retrieval indices or prompts. The manifest itself is never a prompt.
3. **Interpret.** The compiled rules run over the visible text and propose Overlay Annotations: priority matches, provenance signals, a summary.
4. **Anchor.** Each annotation is bound to the page using W3C Web Annotation selectors ([ADR-0002](../../adr/0002-profile-web-annotation.md)), most specific first — a `TextQuoteSelector` with prefix and suffix, backed by a `CssSelector` fallback. Every anchor in this example resolves exactly, so each carries `"status": "exact"`; the summary anchors to the whole document with `"status": "document"`.
5. **Render.** Annotations are layered above the unchanged article. Nothing is rewritten, hidden, or reordered.

The output of steps 1–4 is [`interpretation-result.json`](interpretation-result.json).

## A guided tour of the Interpretation Result

**`ann-1` — highlight, from the local-AI priority.** Anchored to "running open-weight language models on school-owned hardware, where student prompts and drafts never leave the building." The reasoning trace names its cause: the priority `local-first and on-device AI` at weight 0.9, scoped to `technical-research`, matched on three listed terms, and 0.9 clears the tier's highlight threshold. Its `manifestRefs` point into the manifest at `/interpretation/priorities/0` and `/domains/0` — the exact fields responsible. Avery's own rationale ("I build local-first software…") travels with the priority and can be shown in the UI.

**`ann-2` — highlight, from the privacy priority.** Anchored to "student data privacy stops being a clause in a vendor contract and becomes a property of the network architecture," triggered by `/interpretation/priorities/1` (weight 0.7, scope `education-policy`). The trace adds a versioning detail worth noticing: this weight was 0.5 until version 1.4.0, so the trace records that under the previous manifest the passage would still have been highlighted, but ranked lower. Interpretation changes are attributable to manifest changes — that is the point of versioning.

**`ann-3` — evidence indicator on an uncited statistic.** The article states that "41 percent of districts said they now require at least one classroom AI tool to run entirely on hardware the district owns or directly controls" — no survey named, no link given. Because `/interpretation/sources/requireProvenance/0` is `"citations"`, the engine surfaces the absence. The `basis` is explicit that this is an *absence heuristic*: the engine scanned the sentence and its paragraph for links and attribution patterns and found none, and a citation elsewhere in the article would evade it. The trace is equally plain that this is not a verdict on the figure — LensPub surfaces provenance signals and never adjudicates truth ([ADR-0007](../../adr/0007-epistemic-stance.md)).

**`ann-4` — positive evidence indicator on a cited claim.** The 87-percent testing claim links to the Journal's methodology page, and the page's origin matches Avery's trusted source. Two manifest fields coincide, and both appear in `manifestRefs`: `/interpretation/sources/trusted/0` (weight 0.8, with Avery's note quoted in the basis) and `/interpretation/sources/requireProvenance/0` (the same citation rule as `ann-3`, this time reporting presence). The `basis` carries the checkable citation URI, `https://example-journal.example/methodology`. Symmetry matters here: the citation rule fires in both directions, absence and presence, which is what keeps it a signal rather than a stigma.

**`ann-5` — brief document summary.** Anchored to the document as a whole (`"status": "document"`). It exists because `/interpretation/presentation/summaries` is `"brief"`; the trace discloses that at the rule-based tier the summary is extractive — assembled from lead sentences of the paragraphs that scored highest against the priorities — not model-generated. The same manifest at a local-model tier would yield an abstractive summary: manifests are portable, experiences vary by capability tier ([ADR-0004](../../adr/0004-reproducibility-envelope.md)).

**`ann-6` — counterpoint, on request.** The vendor's claim that "Districts that stay on-device give up nothing" invites a rejoinder, but `/interpretation/presentation/counterpoints` is `"on-request"`, so the engine rendered nothing until Avery asked — the trace records that this annotation was user-requested. What Avery gets is retrieval with attribution, not the engine's opinion: the `basis` names an existing, attributed alternative source, *Local AI Tradeoffs* (Consortium for Education Research, 2026) at `https://education-research.example/local-ai-tradeoffs`, and the body presents *that source's* argument about reasoning-task gaps and shifted maintenance burden ([ADR-0007](../../adr/0007-epistemic-stance.md)).

One rule fired by not firing: `contentmill.example`, the distrusted source at `/interpretation/sources/distrusted/0`, produces nothing here because the article does not come from or cite it. A manifest field with no matching signal yields no annotation — lenses add interpretation only where their rules give them a reason to.

## What Avery sees

Rendered in the browser, the two highlights tint their passages, the evidence indicators sit as small markers beside the statistics, the brief summary occupies a collapsed panel above the article, and the counterpoint appears beside the vendor quotation only after Avery asks. Because `/interpretation/presentation/explanationDisplay` is `"on-request"`, the reasoning traces stay behind a gesture: selecting any marker opens its explanation — the same text quoted above, with links from each `manifestRefs` pointer to the manifest field in Avery's lens editor. Every annotation answers "why am I seeing this?" in one step. The interaction grammar — indicators, explanation panels, the request gesture for counterpoints, accessibility requirements for overlays — is specified in [`../../docs/user-experience.md`](../../docs/user-experience.md).

## The Reproducibility Envelope

The `envelope` block records exactly what produced this result: engine `lenspub-poc` version `0.1.0`, capability tier `rule-based`, execution location `local`, generated at `2026-07-09T15:00:00Z`. There is no `model` field because no model ran. The `lens` block pins the interpretation to manifest version 1.4.0 and its content hash — the same hash the Lens Diff's `to` reference records — and `target.contentHash` fingerprints the article text (hashed after whitespace normalization) so drift in the *page* is detectable on revisit.

Now suppose Avery later opts the `technical-research` scope into a cloud model. The manifest's privacy block changes first — `/privacy/remoteInference` becomes `{"allowed": true, "domains": ["technical-research"]}` — because crossing a Trust Boundary is an explicit, per-domain, revocable decision ([ADR-0005](../../adr/0005-local-only-default.md)). Envelopes for articles in that scope then change shape: `execution.location` becomes `"remote"`, the now-required `execution.optInScope` records `"technical-research"` as the authority for the crossing, and a `model` object appears carrying the model identifier, provider, and pin status, alongside `parameters` and a `promptTemplate` reference. If the provider swaps models under the same API, consecutive envelopes stop matching — drift becomes visible evidence instead of a silent change ([ADR-0004](../../adr/0004-reproducibility-envelope.md)).

## How the lens got this way

Version 1.4.0 did not appear by itself. Over the spring, Avery repeatedly expanded evidence indicators on Example Journal articles and marked the privacy highlights as useful — explicit feedback, the only kind that counts. From it the engine drafted a Lens Change Proposal, `lcp-2026-06-17-005`, containing precisely the two changes shown in [`lens-diff.json`](lens-diff.json): add `example-journal.example` as a trusted source (`add` at `/interpretation/sources/trusted/0`, impact **minor**) and raise the student-data-privacy priority weight from 0.5 to 0.7 (`replace` at `/interpretation/priorities/1/weight`, impact **minor**).

Avery's default Adaptation Policy is `balanced`, under which nothing is auto-accepted, so the proposal arrived as a reviewable diff — the `comparison: "self-over-time"` document in this directory, with human-readable summaries and coherent totals (1 added, 1 replaced, highest impact minor). Avery reviewed it, accepted it on 19 June 2026, and the acceptance minted the immutable version 1.4.0 whose hash appears in the diff's `to` reference and in the Interpretation Result's `lens` block. (It does not appear in the manifest's own `versionHistory`: a document cannot contain its own hash, so history lists superseded versions only — 1.4.0's hash will join it when 1.4.0 is itself superseded.) Had the same evidence accumulated in the `politics` scope, no proposal could have been raised at all: that scope is `locked`. The full workflow — feedback, proposal, shadow evaluation, review, rollback — is specified in [`../../spec/adaptation-model.md`](../../spec/adaptation-model.md), with the impact classification and policy parameters from [ADR-0010](../../adr/0010-adaptation-policies-parameterized.md).

Note what the diff does *not* contain: no URLs Avery visited, no excerpts Avery read, no timestamps of reading. Diffs compare history-free manifest cores only ([ADR-0006](../../adr/0006-history-free-shareable-core.md)); the evidence stayed on Avery's device.

## Try it yourself

The browser proof of concept implements this pipeline. Load [`article.html`](article.html), point the extension at [`lens.json`](lens.json), and compare its output against [`interpretation-result.json`](interpretation-result.json). Instructions are in [`../../poc/README.md`](../../poc/README.md).
