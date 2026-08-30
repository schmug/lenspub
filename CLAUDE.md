# CLAUDE.md — LensPub

## What this repository is

A **specification**, not an application. The deliverable is prose, JSON Schemas,
and one deliberately narrow proof of concept. Most work here is editing normative
documents, so the usual instinct — change the code, add a test — is usually wrong.
Read `constitution/DESIGN_HANDOFF.md` first; every other document derives from it.

## Commands

```
npm install            # once; Ajv devDependencies, needed by the scripts below
npm test               # poc/test/run-tests.mjs — engine unit tests + Ajv validation
npm run validate       # scripts/validate-examples.mjs — every JSON example vs its schema
npm run check-links    # scripts/check-links.mjs — every Markdown cross-reference resolves
npm run conformance    # conformance/run.mjs — the protocol suite, vs the PoC adapter
npm run conformance:self-test   # the conformance suite's own tests
```

All five run in CI (`.github/workflows/ci.yml`) on Node 18 and 22, and a
regression in any of them fails the build.

`npm test` and `npm run conformance` answer different questions and must not be
merged. The first tests *this engine's* internals; the second tests *the
protocol*, and `conformance/` imports nothing from `poc/engine/` by design — a
suite sharing code with an engine checks that two copies agree, not that either
conforms. An engine reaches it through one adapter (`conformance/ADAPTER.md`);
the PoC's lives at `poc/conformance-adapter.mjs`, not under `conformance/`.

The browser extension in `poc/` has no build step and no runtime dependencies.

## The gate that catches people out

`GOVERNANCE.md` is binding on this repository's own contents, and it is stricter
than ordinary PR review. **Read it before editing anything under `adr/`,
`constitution/`, `spec/`, or `GLOSSARY.md`.**

- **§3 — `constitution/` and `adr/` are constitutional.** A change needs a written
  proposal (issue or PR), then a **minimum 14-day public review period that may
  not be shortened**, then a maintainer decision recorded in the thread. Accepted
  changes also add a Change Log entry to `constitution/DESIGN_HANDOFF.md`.
- **§4 — substantive errata must be raised as an issue first.** Anything that
  could change what a conforming implementation does — including `spec/` and
  `GLOSSARY.md` prose — qualifies. Editorial errata (typos, broken links,
  formatting) may merge directly.

The tempting mistake is to write an ADR and amend the normative specs it affects
in one pass, because the edits are small and obviously consistent. That routes
around the project's own published process on a repo whose GOVERNANCE §5 commits
to describing itself accurately.

**A new ADR lands as `Status: Proposed`**, citing its review issue and the
earliest valid decision date. While it is Proposed: no dependent document cites
it, no normative text moves, and `adr/README.md` marks it Proposed. The dependent
`spec/` edits are a follow-up PR after the decision. ADRs are numbered
sequentially, never renumbered, and superseded rather than deleted.

## Invariants that are easy to violate by accident

These are normative and appear in more than one document. Changing behavior that
touches them is substantive errata, not a fix.

- **Never rewrite content.** Implementations MUST NOT rewrite, remove, reorder, or
  obscure-by-default the underlying content (`spec/lenspub-protocol.md` §6.2 and
  §7.3, `spec/lens-engine.md` §6.1, `GLOSSARY.md`). Note the open question in
  ADR-0011 about whether this binds a record set with no authored presentation —
  check that ADR's status before assuming either reading.
- **Manifests are history-free.** No URLs visited, no excerpts, no timestamps, no
  feedback records — including inside `extensions` and free-text fields
  (`spec/lens-manifest.md` §3, ADR-0006).
- **A manifest is never a prompt and never weights** (ADR-0001). Engine-compiled
  prompts are fine; they are internal artifacts and are never exchanged.
- **No verdicts.** Evidence-class annotations carry a `basis` — a checkable,
  attributed fact — never a truth judgment (ADR-0007). The schema will not
  represent one without a basis.
- **Local-only by default.** Remote inference is per-domain opt-in (ADR-0005). The
  PoC makes no network requests of any kind; its only `fetch()` calls load its own
  bundled `chrome-extension://` resources.
- **Every annotation carries a reasoning trace; every result a reproducibility
  envelope** (ADR-0004).

## Conventions

- **Licensing is split.** Documentation and specification text is CC-BY 4.0; code,
  schemas, and the PoC are Apache-2.0. New code files carry
  `SPDX-License-Identifier: Apache-2.0`. Do not "simplify" this into one license.
- `poc/engine/*.js` modules are **pure and DOM-free** — the same files run in the
  extension service worker and under Node in the test suite. Keep them that way.
- Examples under `examples/` are validated by `npm run validate`; adding one means
  adding it to the target list in `scripts/validate-examples.mjs`.
- `spike/` is throwaway demonstration code, clearly labelled. It is not the
  reference implementation and does not need to be conformant — but say so where
  it is not.
- Cross-references are load-bearing (726 of them). `npm run check-links` is the
  Phase 0 exit criterion "every cross-reference resolves", so run it after moving
  or renaming any document.
