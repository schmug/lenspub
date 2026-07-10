# Governance

**Status:** Draft v0.1 · **Date:** 2026-07-09 · **License:** CC-BY 4.0

This document describes how the LensPub project is governed. It implements the stewardship decision recorded in [ADR-0009](adr/0009-licensing-and-governance.md) and is referenced by the [constitution](constitution/DESIGN_HANDOFF.md) as the amendment process for constitutional documents.

## 1. What this project is

LensPub is a **personal open project**. It has one maintainer — the project originator — who is the final decision-maker on all changes to the specification, the schemas, the reference implementation, and this governance document itself. There is no working group, no steering committee, and no formal consensus process, and this document will not pretend otherwise: reviewers deserve candor about how decisions are actually made, and the honest description of the current structure is *benevolent-dictator, in public, with a written trail*. What the project commits to is not shared authority but **transparent authority**: every substantive decision is proposed, discussed, and dispositioned where anyone can read it.

## 2. Proposing changes

Anyone may propose a change, and no permission or affiliation is required.

- **Questions and problem reports** are raised as issues on the project repository. An issue that identifies a real defect — a contradiction between prose and schema, a security gap, an ambiguity two implementers could read differently — is the most valuable contribution this project can receive.
- **Concrete changes** are raised as pull requests, accompanied by rationale: what problem the change solves, what alternatives were considered, and which existing documents or ADRs it touches. Substantive changes should begin as an issue for discussion before a PR is written; see [CONTRIBUTING.md](CONTRIBUTING.md).
- The maintainer reviews, discusses, and then accepts, requests changes to, or declines each proposal. Declined substantive proposals receive a written reason. Decisions are made in the issue or PR thread, not in private channels.

## 3. Constitutional changes

The documents under [`constitution/`](constitution/) and [`adr/`](adr/) are the project's constitutional layer: everything else derives from them. They change only through the following process:

1. A **written proposal** — an issue or PR stating the change, its rationale, and its consequences for dependent documents.
2. A **visible review period** of at least **14 days**, during which the proposal is open for public comment. The maintainer may extend this period for far-reaching changes but may not shorten it.
3. A **decision by the maintainer**, recorded in the thread.
4. For accepted changes: an entry in the **Change Log** of `constitution/DESIGN_HANDOFF.md`, and — where the change alters or reverses a recorded decision — a new ADR that supersedes the old one. ADRs are never renumbered or deleted; superseded ADRs are marked as superseded and remain in the record.

## 4. Errata

Ordinary specification errata follow normal pull-request review, without a mandatory review period:

- **Editorial errata** — typos, broken links, formatting, wording clarifications that cannot change an implementation — may be merged directly by the maintainer.
- **Substantive errata** — anything that could change what a conforming implementation does, including corrections where prose and a JSON Schema disagree — must be raised as an issue first, and the resolution is noted in the affected document. When prose and schema conflict, the schema is presumed correct for object structure unless the resolution states otherwise.

## 5. The commitment to candor

This project commits to describing itself accurately. It will not present maintainer decisions as community consensus, will not simulate a working group that does not exist, and will not label documents with a maturity they have not earned (v0.1 means draft). Where the specification overclaims, correcting the claim takes priority over defending it. This commitment is itself constitutional in spirit: proposals to weaken it receive the Section 3 process.

## 6. Path to neutral stewardship

Single-maintainer governance is appropriate for a draft and wrong for a widely adopted standard. Per [ADR-0009](adr/0009-licensing-and-governance.md) and the [roadmap](docs/roadmap.md), if LensPub reaches meaningful multi-implementation adoption, the maintainer intends to migrate the project to neutral stewardship — a community group or foundation home with shared decision-making. The licensing (CC-BY 4.0 for specification text, Apache-2.0 for code; see [LICENSE.md](LICENSE.md)) was chosen so that this migration requires no relicensing and no contributor's permission. Until then, the interim guarantee is the license itself: everything here can be forked, implemented, and continued by others regardless of what the maintainer does.

## 7. Code of conduct

This project adopts the [Contributor Covenant, version 2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/) by reference; conduct concerns may be reported privately to the maintainer.
