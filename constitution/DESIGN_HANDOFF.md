# DESIGN_HANDOFF.md

## Project

**LensPub**

An open protocol for publishing, exchanging, and applying user-owned interpretation layers.

---

## Purpose

This document is the authoritative design handoff — the project **constitution** — for the LensPub specification repository.

Every other document in this repository derives from this one. Agents and contributors working on LensPub should treat the decisions recorded here as settled rather than revisiting them. Changes to this document follow the amendment process in `GOVERNANCE.md` and are recorded in the Change Log at the bottom of this file.

The goal of the authoring effort is not to invent the protocol, but to transform the decisions captured here into a complete, publication-quality open specification. The resulting repository should read more like an IETF RFC, W3C proposal, or ActivityPub specification than traditional software documentation.

---

## Core Thesis

Throughout history, advances in technology have dramatically lowered the cost of creating information.

As creation becomes easier, society must invent a new quality gate.

Examples include:

- Books → publishers and editors
- The Web → search engines
- Social Media → platform recommendation algorithms
- Generative AI → (currently unresolved)

The central proposal of LensPub is that the next quality gate should belong to the individual, not the platform.

Rather than allowing corporations to determine what information is valuable, every person should own, inspect, modify, version, and share their own interpretation layer.

---

## Architectural Claim

LensPub proposes a new stage in how the web is experienced: **interpretation**.

Conceptually, the web a user experiences today is shaped by transport, content, presentation, and behavior. LensPub adds interpretation as a portable, inspectable, user-owned layer that sits above rendered content.

Precisely stated: interpretation is **not** a new network layer. It is a **user-agent-side, post-render overlay stage** that operates on the rendered document (the DOM and accessibility tree) after content, presentation, and behavior have done their work. The "layer" language is retained as conceptual framing in vision documents; the Architecture specification defines the precise operating point. *(Amended per review, 2026-07-09; see ADR-0008.)*

---

## Vision

Every user owns an AI-powered interpretation layer that:

- operates locally whenever possible
- transparently explains its decisions
- never silently changes
- evolves only according to user-defined adaptation policies
- is portable between devices and applications
- can be versioned, diffed, exported, and shared

The interpretation layer belongs to the user rather than any platform.

---

## Primary Concepts

The repository consistently uses the following terminology. The complete normative vocabulary lives in `GLOSSARY.md`.

### LensPub

The open ecosystem and protocol.

### Lens Manifest

A portable description of a user's interpretation preferences.

The Lens Manifest is the primary exchange object. It is a **declarative, model-agnostic policy document** — never model weights and never a prompt. It expresses intent; a Lens Engine compiles that intent into engine-specific artifacts. *(Decision D1; see ADR-0001.)*

### Lens Engine

The runtime responsible for applying a Lens Manifest.

Reference implementations may use local LLMs, cloud models, rule engines, or hybrid systems.

The protocol must remain model-agnostic.

### Lens Diff

A structured comparison between two Lens Manifests.

Users should be able to compare:

- themselves over time
- themselves versus another user
- multiple subscribed lenses

without exposing private browsing history.

---

## Guiding Principles

The specification should consistently reinforce these principles:

- User ownership
- Transparency
- Local-first design
- Explainability
- Reversibility
- Portability
- Open standards
- Privacy by default
- Vendor neutrality
- Human agency over automation

---

## Adaptation Model

One of the defining characteristics of LensPub is that users control how quickly their interpretation layer is allowed to evolve.

Learning is never silent.

Lens evolution follows a proposal workflow:

Read Content → Explicit Feedback → Lens Engine proposes change → Shadow / A-B evaluation → User review → Accept / Reject / Modify

Every accepted change becomes versioned. Users can inspect complete Lens history.

**Manifest stability vs. output reproducibility.** The "never silently changes" guarantee applies to the **Lens Manifest**, which changes only through the proposal workflow and is fully versioned. Interpretation **output** reproducibility is best-effort: engines that use large models are subject to model drift and provider-side model changes. To make such drift visible rather than silent, every interpretation result MUST carry a reproducibility envelope recording the engine version, model identifier/hash, parameters, and prompt-template identifier used. Users must be able to see, and where possible pin, the model their lens runs on. *(Amended per review, 2026-07-09; Decision D4; see ADR-0004.)*

---

## Lens Stability

Lens Manifests include configurable adaptation policies. Five named policies are defined, as points on explicit, protocol-defined parameters (proposal frequency, evidence threshold, auto-accept ceiling — see ADR-0010):

1. Locked
2. Conservative
3. Balanced
4. Adaptive
5. Explorer

These policies may also exist per domain, with per-domain settings taking precedence over the lens-wide default.

Example:

- Politics → Locked
- Technical Research → Adaptive
- Entertainment → Explorer

---

## Sharing

Lenses should be portable.

Capabilities include:

- subscriptions
- signed manifests
- collaborative lenses
- exported public lenses
- partner lenses
- expert lenses
- organization lenses

Sharing never requires sharing browsing history. Adaptation state derived from a user's reading is stored as explicit, reviewable deltas layered on the manifest core; the **shareable object is the history-free core only**. *(Decision D6; see ADR-0006.)*

Signed manifests, publisher identity, and expert/organization lenses use W3C Verifiable Credentials 2.0, Decentralized Identifiers (DIDs), and VC Data Integrity. *(Decision D3; see ADR-0003.)*

---

## Reader Experience

LensPub preserves author intent while allowing user-owned interpretation.

The preferred model is:

Original content remains unchanged.

Lens Engine overlays:

- annotations
- summaries
- evidence indicators
- primary source expansion
- counterpoints
- explanation of why something is highlighted

Avoid silently rewriting original content. Interpretation is layered rather than substituted.

The overlay and anchoring model is defined as a **profile of the W3C Web Annotation Data Model** and its Selectors and States vocabulary, with a defined robust-anchoring fallback strategy for dynamic content. *(Decision D2; see ADR-0002.)*

---

## Browser Proof of Concept

The initial proof of concept targets a browser.

Reasons:

- lowest barrier to entry
- demonstrates protocol usefulness
- browser naturally sits at the interpretation boundary

Architecture should remain extensible toward system-wide interpretation later.

---

## Privacy

User interpretation belongs to the user.

The privacy default is **local-only inference**. Use of any cloud model is an explicit, per-domain, revocable opt-in, and the trust boundary crossed by doing so must be made visible to the user. *(Decision D5; see ADR-0005.)*

Organizations may receive only explicitly consented, aggregated, privacy-preserving signals.

The protocol must avoid creating another surveillance ecosystem.

---

## Epistemic Stance

LensPub **surfaces provenance and signals, and ranks interpretations** — annotations, summaries, evidence indicators — in a user-owned, inspectable way. It never adjudicates truth, and it never ranks content opaquely. This is the boundary that distinguishes LensPub from both a truth engine and a recommendation algorithm. *(Decision D7; see ADR-0007.)*

---

## Threat Model

The specification discusses:

- prompt injection
- manipulation attempts
- lens poisoning
- adversarial optimization
- fake public lenses
- signature verification
- rollback
- malicious subscriptions
- privacy leakage
- model drift

---

## Scope

The repository defines:

- concepts
- protocol
- object formats
- lifecycle
- security model
- privacy model
- reference architecture
- relationship to prior art and existing standards *(amended per review, 2026-07-09)*
- conformance model and normative language (BCP 14 / RFC 2119 / RFC 8174) *(amended)*
- media-type registration for exchange objects *(amended)*
- accessibility requirements for interpretation overlays *(amended)*
- legal and ecosystem considerations *(amended)*
- governance and licensing of the standard itself *(amended)*

The repository should not become implementation-specific.

---

## Standards Posture

LensPub **profiles** existing standards where they exist and authors new specification only where none does:

- **Profiles:** W3C Web Annotation Data Model + Selectors and States (overlay/anchoring); W3C Verifiable Credentials 2.0 + DIDs + VC Data Integrity (identity, signing, trust).
- **Complements:** Solid (manifest hosting is abstract in v1 — any URL or DID — with Solid pods defined as an optional hosting profile); ActivityPub / AT Protocol (lens subscription and federation are transport-agnostic in v1, with AT Protocol as the reference binding); C2PA Content Credentials (consumed as a provenance signal).
- **Replaces:** nothing.

*(Decisions from review Section 9, accepted 2026-07-09.)*

---

## Non-Goals

LensPub is not:

- a truth engine
- censorship software
- a recommendation algorithm
- a replacement for the Web
- tied to any LLM vendor
- tied to any browser

LensPub standardizes user-owned interpretation.

---

## Deliverables

The repository includes:

- README
- Vision
- Problem Statement
- Design Principles
- Relationship to Prior Art *(amended)*
- LensPub Specification (including conformance model and media types)
- Lens Manifest Specification
- Lens Engine Specification
- Architecture
- User Experience
- Adaptation Model
- Lens Diff
- Security
- Privacy
- Threat Model
- Reference Implementation (browser proof of concept)
- Future Roadmap
- ADRs
- Example Lens Manifests
- JSON Schemas for all exchange objects *(amended)*
- One complete end-to-end worked example *(amended)*
- Governance and licensing *(amended)*

Each document should be publication quality and internally consistent.

---

## Success Criteria

At the conclusion of authoring:

- A software engineering team should be able to begin implementation.
- Multiple independent implementations should be possible.
- The protocol should be understandable without reference to a specific AI model.
- The repository should resemble a mature open standards proposal suitable for public discussion.
- The repository contains at least one complete end-to-end worked example: a page, a manifest, the resulting annotated overlay, and the engine's reasoning trace. *(amended per review, 2026-07-09)*

---

## Project Stewardship

LensPub is a personal open project stewarded by its originator, with a lightweight public change process defined in `GOVERNANCE.md`. The specification is licensed CC-BY 4.0; reference implementation code is licensed Apache-2.0. *(Decisions D9 and review Section 9, accepted 2026-07-09.)*

---

## Change Log

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-07 | Original handoff authored in conversation. |
| 1.1 | 2026-07-09 | Design review amendments accepted by project owner: decisions D1–D10 recorded as ADRs 0001–0010; adaptation policies fixed at five; architectural claim restated as user-agent-side overlay stage; scope expanded (prior art, conformance, media types, accessibility, legal, governance); manifest-stability vs. output-reproducibility distinction added; epistemic stance added; standards posture added (abstract hosting with Solid profile, transport-agnostic federation with AT Protocol reference binding); worked-example success criterion added; licensing (CC-BY 4.0 / Apache-2.0) and personal-open-project stewardship recorded. |
