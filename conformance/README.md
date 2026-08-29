# LensPub v0.1 Conformance Suite

**Status:** Draft v0.1 · **Date:** 2026-08-28

A specification-level test suite that any Lens Engine can run to demonstrate, mechanically, that it implements the LensPub protocol. It is the Phase 1 deliverable named in [`../docs/roadmap.md`](../docs/roadmap.md): *a conformance suite that the reference implementation passes*, covering manifest validity, anchoring degradation, adaptation-policy parameter enforcement, and privacy invariants.

The point is to replace a reading-comprehension answer with a mechanical one. Before this suite, "does your engine conform?" could only be answered by an implementer reading four specifications and asserting that they had followed them. Now it is answered by 61 vectors, each traced to the normative sentence it mechanizes, each reported pass, fail, or skipped.

```
npm install                              # once
npm run conformance                      # against the reference PoC
npm run conformance -- --adapter ./my-adapter.mjs
npm run conformance:self-test            # the suite's own tests
```

This suite is **not** [`../poc/test/run-tests.mjs`](../poc/test/run-tests.mjs), which tests the reference engine's internals. This one tests the protocol, and it imports nothing from [`../poc/engine/`](../poc/engine/) — a suite that shared code with an engine would be checking that two copies agree rather than that either conforms.

## What it certifies

Conformance is claimed per **role**, not as a single verdict. An adapter declares the roles its engine implements; vectors for roles it does not declare are **skipped**, and a skip is never counted as a pass.

| Role | Conformance target | What the vectors assert |
|---|---|---|
| `manifest-consumer` | [Lens Manifest §2](../spec/lens-manifest.md), [protocol §7.1](../spec/lenspub-protocol.md) | Documents that fail schema validation are rejected; valid manifests are accepted; a declared protocol version other than `0.1` is refused; unrecognised `extensions` entries are ignored rather than rejected |
| `anchor-resolver` | [Lens Engine §5](../spec/lens-engine.md), [ADR-0002](../adr/0002-profile-web-annotation.md) | The exact → degraded → unanchored ladder; disambiguation of a repeated quote by `prefix`/`suffix`; and above all that no annotation is guess-anchored — an absent or near-miss quote never resolves `exact` |
| `lens-engine` | [Lens Engine §2, §4.2](../spec/lens-engine.md), [protocol §7.3](../spec/lenspub-protocol.md) | The rule-based floor (priority highlighting, source-trust surfacing, provenance-absence indicators, presentation preferences); and, applied to every result the suite obtains, the unconditional invariants: schema validity, a reasoning trace on every annotation, a `basis` on every evidence-class annotation, an envelope, and local execution absent a real opt-in |
| `adaptation-engine` | [Adaptation Model §2](../spec/adaptation-model.md), [ADR-0010](../adr/0010-adaptation-policies-parameterized.md) | The five presets' normative parameter values; parameter override and per-domain precedence, including the most-restrictive combination across scopes; the impact-classification rules; and auto-acceptance, where **auto-accepting above the effective `autoAcceptCeiling` is asserted specifically as a conformance violation** |
| `differ` | [Lens Diff §2, §4](../spec/lens-diff.md) | A diff over two conforming cores reports the changed field at its precise pointer with an impact and a summary; and an input carrying a field the manifest schema does not define is **refused outright**, not stripped and diffed anyway |

Some vectors declare no role at all. They assert properties of the normative schemas in [`../schemas/`](../schemas/) — that a manifest carrying reading history is rejected, and rejected *on the keyword that exists to stop it*. Every implementation gets those by validating against the schema, so they run for every adapter and are not a claim about any engine.

### Coverage

| Area | Vectors | Positive | Negative |
|---|---|---|---|
| Manifest validity and consumption | 23 | 10 | 13 |
| Anchoring and degradation | 7 | 2 | 5 |
| Adaptation-policy enforcement | 22 | 10 | 12 |
| Privacy invariants | 9 | 1 | 8 |

Negative vectors are the half that does the work. An engine that accepts every manifest, anchors every quote wherever it likes, and auto-accepts every proposal passes a suite of positive vectors trivially; the suite's own tests require such an engine to fail every adapter-driven negative vector. The positives are the other jaw of the same pincer: an engine that refuses everything must fail those.

## What it does not certify

Running this suite green is evidence about the requirements it mechanizes. It is not a certificate, and this section is longer than the last one on purpose.

**A pass is scoped to what ran.** It covers the roles you declared, at the capability tier you declared, for the vectors that were not skipped. The report prints skip counts next to pass counts for exactly this reason. Reduced richness at a lower tier is conforming ([ADR-0004](../adr/0004-reproducibility-envelope.md)); the suite does not grade interpretation quality, and passing says nothing about whether a lens is useful.

**Free text is not checked, and cannot be.** The history-free rule ([ADR-0006](../adr/0006-history-free-shareable-core.md)) is enforced structurally: every object in the manifest schema closes itself, so reading history has no member to live in. That defence stops an *undeclared* field. It does not stop a URL typed into a priority's `rationale`, a source's `note`, a Domain Scope's `description`, or anything under `extensions`, which the schema deliberately leaves open. The same limit applies to [ADR-0001](../adr/0001-manifest-is-declarative-policy.md): the suite detects a manifest with a `prompt` member, not prompt text pasted into a rationale. Pre-publication disclosure review ([Privacy Model §4](../security/privacy-model.md)) is the protocol's answer to that, and it is a consent mechanism rather than a mechanical one.

**Behaviour outside the exchange objects is invisible here.** The adapter hands the engine already-extracted text and takes a structured result back, so the suite never observes the host document. It therefore cannot check that the engine did not rewrite content ([protocol §7.3, invariant 1](../spec/lenspub-protocol.md)), that degraded and unanchored annotations are *visibly marked* where they are displayed, that an auto-accepted change was notified with one-tap rollback, that the remote trust boundary is indicated before and during a crossing, or that no telemetry is transmitted ([Privacy Model §9](../security/privacy-model.md)). Several of those are absolute requirements. None is mechanically checkable from outside, and a green run is not evidence about any of them.

**Whole subsystems are out of scope for v0.1 of this suite.** Signing and verification ([ADR-0003](../adr/0003-adopt-vc2-dids-for-trust.md), [Security Model](../security/security-model.md)); subscription resolution, fetch, and pinning; the AT Protocol binding; the diff *renderer* target of [Lens Diff §2](../spec/lens-diff.md), which is a presentation component; JCS canonicalization ([Lens Diff §5.1](../spec/lens-diff.md)); the referential-integrity requirements of [Lens Manifest §5](../spec/lens-manifest.md); and anything measured over time, such as whether an engine honours a `proposalFrequency` budget across a week — the vectors check the *resolved* parameter, not a week of behaviour.

**There is no certification process.** No badge, no registry, no authority that blesses a result. Those are governance questions, and [GOVERNANCE.md](../GOVERNANCE.md) does not answer them today. What you can do with a green run is publish it: `--json` emits a machine-readable report naming every vector, its outcome, and the normative sentence behind it, which is a claim with evidence attached rather than an assertion.

## Reading the output

```
  PASS  + manifest/consumer-accepts-conforming-manifest
  FAIL* − adaptation/auto-accept-above-ceiling-is-a-conformance-violation
  SKIP  − privacy/differ-refuses-input-with-an-undeclared-field
```

`+` and `−` mark positive and negative vectors. `FAIL*` marks a **conformance violation** — a wrong answer the specification names as such, rather than a difference of quality; `FAIL` alone is an ordinary mismatch. Every failure prints the requirement it broke and the sentence that states it. The run ends with a per-requirement rollup (`PASS`, `PASS (partial)`, `NOT DEMONSTRATED`, `FAIL`), which is the answer to "which requirements did I actually demonstrate?", and exits non-zero if anything failed. Skips never change the exit status and never appear as passes.

## Wiring your engine

Implement one interface, in one file, next to your engine. You do not fork this suite, and you do not add anything to it.

- **In JavaScript** — copy [`adapters/example-adapter.mjs`](adapters/example-adapter.mjs), fill in the methods for the roles you implement, and run `npm run conformance -- --adapter ./your-adapter.mjs`. The reference engine's own adapter, [`../poc/conformance-adapter.mjs`](../poc/conformance-adapter.mjs), is 50 lines and is the worked example.
- **In any other language** — implement a read-eval-print loop over newline-delimited JSON and use [`adapters/subprocess-adapter.mjs`](adapters/subprocess-adapter.mjs), which starts your engine as a child process. The vectors are plain JSON for this reason: nothing needs porting. [`self-test/subprocess-engine.mjs`](self-test/subprocess-engine.mjs) is a minimal loop to read as a shape.

The full contract — every argument, every return value, and what each role commits you to — is [ADAPTER.md](ADAPTER.md).

## The vector format

Every vector is one JSON file under [`vectors/`](vectors/), validated against [`vectors/conformance-vector.schema.json`](vectors/conformance-vector.schema.json) before anything runs. A vector with a typo in `check` or `expect` would otherwise assert nothing and report a pass, which is the one failure mode a conformance suite may not have.

```json
{
  "id": "adaptation/auto-accept-above-ceiling-is-a-conformance-violation",
  "area": "adaptation",
  "polarity": "negative",
  "requirement": {
    "document": "spec/adaptation-model.md",
    "section": "2",
    "text": "Auto-acceptance of a proposal above the effective autoAcceptCeiling is a conformance violation.",
    "adr": "adr/0010-adaptation-policies-parameterized.md"
  },
  "role": "adaptation-engine",
  "check": "proposal.disposition",
  "input": { "policy": { "...": "..." }, "proposal": { "impact": "minor" } },
  "expect": { "disposition": "require-review", "conformanceViolationIf": ["auto-accept"] }
}
```

`check` selects the operation and fixes the shape of `input` and `expect`; the eight checks are documented in [ADAPTER.md](ADAPTER.md). `requirement` is mandatory and load-bearing: a vector that cannot cite a normative sentence is a vector asserting the author's preference.

### Adding one

1. Write the JSON under `vectors/<area>/<slug>.json`, with `id` equal to `<area>/<slug>`. The runner rejects a mismatch, a duplicate id, and anything that fails the vector schema.
2. Quote the requirement. If you cannot find the sentence, the vector may be describing behaviour the specification does not require — which is a specification issue to raise under [GOVERNANCE.md §4](../GOVERNANCE.md), not a vector to add.
3. For a negative vector, say in `rationale` why the prohibited answer is a *conformance violation* rather than a quality difference, and use `conformanceViolationIf` or `prohibitedStatus` where the specification says so outright.
4. Leave latitude where the specification leaves it. Fuzzy anchor matching is OPTIONAL, so `anchoring/degrades-on-whitespace-drift` accepts either `degraded` or `unanchored` and prohibits only `exact`. A vector that demands one conforming choice over another is a bug in the vector.
5. Run `npm run conformance:self-test`. It checks, among other things, that every area still has both polarities and that no vector has become unexercised.

## The suite's own tests

`npm run conformance:self-test` is the evidence that the suite means anything. It runs the vectors against deliberate fixtures in [`self-test/`](self-test/) and asserts that:

- an engine that **accepts everything** fails every adapter-driven negative vector, and that the ceiling breach, guess-anchoring, the tolerant differ, and un-opted-in remote execution are each reported as conformance violations;
- an engine that **refuses everything** fails the positive consumer vectors;
- an adapter declaring **no roles** skips every role-bearing vector and passes none;
- the reference PoC fails nothing applicable to it, and the spec-literal fixture fails nothing applicable to it;
- **every vector is exercised** by some fixture, except those deliberately scoped to a capability tier no fixture declares;
- the subprocess transport reaches identical verdicts to the in-process adapter.

`self-test/mock-spec-literal.mjs` implements, from the normative tables, the two roles the reference PoC does not have. It is a fixture, not a second implementation and not a reference — it interprets nothing, and its differ is explicitly partial. It exists so that the adaptation and diff vectors are run by something rather than sitting permanently skipped.

## Licensing

Code and vectors in this directory are licensed **Apache-2.0** ([`../LICENSE-CODE`](../LICENSE-CODE)); the specification text they test is CC-BY 4.0. See [`../LICENSE.md`](../LICENSE.md).
