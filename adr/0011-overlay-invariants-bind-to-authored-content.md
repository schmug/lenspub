# ADR-0011: The overlay invariants bind to authored rendered content; a lens-rendered Record Set is a distinct substrate

**Status:** Proposed · 2026-08-28 · Opened for review under [GOVERNANCE.md §3](../GOVERNANCE.md) in [issue #4](https://github.com/schmug/lenspub/issues/4) (minimum 14-day review period, so no decision before 2026-09-11; the maintainer's decision is recorded in that thread)

## Context

[ADR-0008](0008-interpretation-is-overlay-stage.md) defines interpretation as a user-agent-side, post-render overlay stage operating on a rendered document's DOM and accessibility tree. Four normative statements derive from it and forbid reordering:

- [LensPub Protocol §6.2](../spec/lenspub-protocol.md) — on Apply, "the underlying content MUST NOT be rewritten, obscured by default, or reordered";
- [LensPub Protocol §7.3](../spec/lenspub-protocol.md), Unconditional Requirement 1 — "Implementations MUST NOT rewrite, remove, reorder, or obscure-by-default the underlying content";
- [Lens Engine §6.1](../spec/lens-engine.md) — "An engine MUST NOT mutate, reorder, or remove the underlying content";
- [Glossary, Overlay Annotation](../GLOSSARY.md) — Overlay Annotations "MUST NOT rewrite, obscure by default, or reorder the underlying content".

Every one of these presupposes something v0.1 never names: that an **authored presentation already exists**. A publisher chose an order and a layout, delivered it, and the reader chose that artifact. The prohibition is meaningful because there is a prior arrangement belonging to someone else, and disturbing it would substitute the engine's judgment for the author's.

Two directions already inside the project's scope have no such prior arrangement.

The first is the [roadmap's](../docs/roadmap.md) Phase 3, which targets a non-browser embodiment — an e-reader, a feed client, or an OS-level agent. A feed client's input is a set of items, not a page. Nothing in that set was laid out for the reader by a publisher; the client arranges it.

The second is any engine whose input is structured data rather than a rendered document. A [spike](../spike/README.md) in this repository demonstrated the case concretely: twelve records with no authored presentation, a prompt compiled into a Lens Manifest, and the manifest rendering the records as an evidence table, a timeline, a source grouping, or a priority ranking. Three of those views change order. Under a literal reading of the four statements above they are non-conformant — even though no record is ever hidden, removed, rewritten, filtered, or truncated, and the canonical order remains one interaction away.

The literal reading produces an odd result: an engine that presents every record faithfully is non-conformant for choosing an order, in a situation where declining to choose one is impossible. Something must be presented first. The invariant has no referent, because there is no authored order to preserve.

The risk in relaxing it is real and worth naming plainly. The reorder prohibition is load-bearing against the failure mode LensPub exists to avoid: a lens that quietly becomes a recommender. Ordering *is* most of what a recommendation algorithm does. Any carve-out must replace the prohibition with an obligation that is at least as hard to violate silently.

## Decision

1. The overlay invariants — MUST NOT rewrite, remove, reorder, or obscure-by-default — bind to **Authored Rendered Content**: content whose presentation order and layout were chosen by a publisher and delivered to the reader as such. This is the substrate ADR-0008 describes and the only substrate v0.1 specifies.

2. A second substrate is recognized. A **Record Set** is a collection of structured items delivered to the user agent without an authored presentation, where the Lens Engine is the first renderer. Over a Record Set the reorder prohibition does not apply, because no authored order exists to preserve.

3. Over a Record Set the remaining invariants bind unchanged, and one is added. An engine interpreting a Record Set MUST satisfy a **completeness obligation**: every record in the input MUST be present in the rendered result. De-emphasis MUST NOT remove a record; an engine MUST NOT filter, sample, rank-and-truncate, or paginate away any record as a consequence of the lens; and where an engine cannot present every record it MUST say which records are absent and why. This is the same structural line [ADR-0007](0007-epistemic-stance.md) draws between ranking *interpretations* and ranking *content*, restated for a substrate where ranking is unavoidable.

4. Presentation order over a Record Set MUST be attributable. Where a lens produces an order other than the input order, the engine MUST make the input order available to the user and MUST indicate that the displayed order is the lens's, not the source's.

5. ADR-0008 is **refined, not reversed**. Its definition of interpretation as a user-agent-side, post-render stage is unchanged; this ADR states the substrate its derived invariants were written against, and what binds on the other one.

## Consequences

- Requirements 3 and 4 are conformance-checkable, which is what makes the carve-out safe to grant. The spike implements both: it hashes the record set before and after every render, counts presented records against the input, sweeps the rendered output for every record identifier, and fails visibly when a view drops one. A completeness obligation an implementation cannot quietly violate is a stronger guarantee than a prohibition nobody measures.
- Four dependent documents need a scoping sentence and the new term: Protocol §6.2 and §7.3, Lens Engine §6.1, and the Glossary. **This ADR does not make those edits.** They are substantive errata under [GOVERNANCE.md §4](../GOVERNANCE.md) and follow only if this proposal is accepted.
- Phase 3 acquires a definition before it needs one. A feed client or OS-level agent has a conformance target that does not require pretending its input is a page.
- The Record Set substrate is the obvious place a lens could become a recommender, and this ADR concentrates the defense in requirements 3 and 4 rather than in the reorder prohibition. If review concludes those two are insufficient, the correct outcome is to reject this proposal, not to weaken them.
- Nothing here authorizes a lens to choose *what* the user reads. A Record Set arrives already chosen; the lens arranges what it was given and must account for all of it. The [no-feed commitment](../docs/user-experience.md) is unaffected.

## Alternatives considered

**No change; record-set rendering is out of scope.** LensPub overlays content someone else authored, and an application that renders structured data is a different product. Rejected: the roadmap already commits to a non-browser embodiment in Phase 3, and a feed client meets this on its first day. Declining the question does not remove it, it only leaves the invariant literally false for one of the two substrates the project claims.

**Amend the four normative sites in place, without an ADR.** Faster and textually equivalent. Rejected: the reasoning would live nowhere, ADR-0008's basis would stay silent on why an exception exists, and [GOVERNANCE.md §3](../GOVERNANCE.md) directs that a change altering a recorded decision be captured as a new ADR.

**Extend the prohibition to Record Sets.** Hold the line and forbid reordering everywhere. Rejected: it compels every record-set engine to emit a fixed arbitrary order, which is itself an unexplained editorial choice, and it forbids the timeline and evidence-table presentations that make a record set legible — without protecting anything, since the prohibition guards an authored order that does not exist here.

**Treat order as a presentation preference and stop there.** Let the manifest declare an order and call the matter settled. Rejected: it answers where the instruction comes from, not what the engine owes the reader. Requirements 3 and 4 are obligations on the engine regardless of what any manifest says.

## Open question for review

Does a Record Set whose *publisher* chose the order — an editor-curated list delivered in a deliberate sequence — count as Authored Rendered Content? This proposal's position is yes: authorship turns on whether an order was chosen for the reader, not on the container format. Reviewers who disagree should say so, because the answer determines whether a curated feed is one substrate or the other.
