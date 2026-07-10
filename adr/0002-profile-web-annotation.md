# ADR-0002: Overlay and anchoring are a profile of W3C Web Annotation

**Status:** Accepted · 2026-07-09

## Context

LensPub's reader experience is an overlay: annotations, summaries, evidence indicators, counterpoints anchored to unchanged content. Anchoring annotations to web content that moves — single-page apps, personalization, A/B variants, edits, translations — is a decades-old hard problem with substantial prior art: the W3C Web Annotation Data Model and its Selectors and States vocabulary, and the fuzzy/robust-anchoring literature (Hypothesis, Microsoft Research). Inventing a new annotation vocabulary would duplicate a W3C Recommendation, forfeit existing tooling, and signal unseriousness to standards reviewers.

## Decision

LensPub Overlay Annotations are defined as a **profile of the W3C Web Annotation Data Model**, using the Selectors and States vocabulary (TextQuoteSelector, TextPositionSelector, CssSelector, XPathSelector, RangeSelector) for anchoring. The profile adds LensPub-specific properties (reasoning trace, reproducibility envelope reference, interpretation kind) via the model's standard extension mechanism.

The Lens Engine specification defines a **robust-anchoring fallback strategy**: engines MUST attempt selectors in order of specificity, MUST degrade gracefully (attach at the nearest stable ancestor, or present unanchored in a margin panel) when exact anchoring fails, and MUST NOT guess-anchor silently — an annotation displayed at a degraded anchor is marked as such.

## Consequences

- Interoperability with existing annotation tooling and stores comes for free.
- Anchoring robustness remains an engine-quality dimension rather than a protocol invention; the protocol specifies required behavior at failure, not a novel algorithm.
- LensPub inherits Web Annotation's JSON-LD serialization; the profile constrains it to a JSON shape that plain-JSON consumers can process.

## Alternatives considered

Custom annotation format (rejected: reinvention, no tooling); DOM-node references only (rejected: brittle); content fingerprinting as primary anchor (deferred: available to engines as an internal technique, not a protocol requirement).
