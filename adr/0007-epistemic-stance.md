# ADR-0007: LensPub surfaces provenance and ranks interpretations; it never adjudicates truth and never ranks content opaquely

**Status:** Accepted · 2026-07-09

## Context

Two of the constitution's non-goals — "not a truth engine" and "not a recommendation algorithm" — sit in tension with two of its features: evidence indicators/counterpoints (which imply epistemic judgment) and adaptive highlighting (which is personalized ranking). Without an explicit boundary, critics can fairly claim the non-goals are false, and implementers will drift toward truth-scoring because it is the path of least resistance.

## Decision

LensPub's epistemic stance is fixed as follows:

- **Surface, don't adjudicate.** Engines surface *verifiable signals* — provenance (e.g., C2PA Content Credentials), citation presence, source identity, corroboration links, counterpoint availability — and always show the basis for a signal. Engines MUST NOT emit verdicts of the form "this is true/false." An evidence indicator is a pointer to checkable facts about the content, never a truth score.
- **Rank interpretations, not content.** What a lens prioritizes, highlights, or summarizes is (a) applied to content the user has already chosen to view, (b) governed by a manifest the user owns and can read, and (c) explained per-annotation via reasoning traces. This is the categorical difference from a recommendation algorithm, which selects *what the user sees* using criteria the user cannot inspect.
- **Counterpoints are sourced.** A counterpoint overlay presents an existing, attributed alternative source or argument — it is retrieval with attribution, not the engine's own editorial rebuttal.

## Consequences

- The non-goals become defensible: the distinction is structural (ownership + inspectability + layering), not rhetorical.
- Some user demand ("just tell me if it's true") is deliberately unmet; the UX spec channels it into evidence display.
- Engines need attribution plumbing for counterpoints; the Interpretation Result schema requires a `basis` on evidence-class annotations.

## Alternatives considered

Truth-scoring with confidence values (rejected: builds the truth engine the constitution forbids and inherits its failure modes); no evidence features at all (rejected: guts the reader experience); unsourced model-generated counterpoints (rejected: launders engine opinion as fact).
