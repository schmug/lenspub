# Spike — prompt-to-lens

**Throwaway.** Not specification, not the PoC, not a conformance claim. Built to
answer one question and be argued with.

## The question

Can a natural-language prompt produce a lens *without the lens becoming a
prompt* ([ADR-0001](../adr/0001-manifest-is-declarative-policy.md)), and can the
resulting view be **shown** — not merely asserted — to leave the underlying
records untouched ([ADR-0008](../adr/0008-interpretation-is-overlay-stage.md))?

## Framing

The twelve records are the backend truth. The rendered view is the frontend
lens applied to that truth. The prompt is an authoring input only: it compiles
to a declarative Lens Manifest and is then discarded. It never enters the
manifest.

## Run it

```
open spike/lens-view-spike.html
```

No server, no build, no network, no webfonts. Type a prompt or click an example.
The left column shows what compiled, what did not, and the live manifest.

```
node spike/verify-spike.mjs
```

58 checks: every prompt compiles to a manifest that Ajv-validates against
`schemas/lens-manifest.schema.json`; manifest string values stay inside a closed
vocabulary; two phrasings of one policy compile to an identical manifest; every
lens presents 12/12 records with none duplicated; the record set is unmutated
after every lens; de-emphasized and distrusted records stay present in full;
no evidence cell contains verdict language. Needs the root `npm install`.

The verifier extracts `<script id="lens-engine">` from the HTML and runs it, so
the code under test is the code the page executes.

## What it found

1. **Prompt-as-authoring-input holds.** The compiler is deterministic and its
   output vocabulary is closed, which is checkable: the verifier asserts that no
   manifest string value contains a word the compiler could not have produced,
   and that two different phrasings of the same policy compile byte-identically.
   That equivalence — not the absence of the word "prompt" — is what ADR-0001 is
   really protecting.

2. **ADR-0008 becomes a measurement, not a promise.** The readout hashes the
   record set on every render, the substrate strip shows one tick per canonical
   record, and a post-render DOM sweep turns the counter red if a view drops a
   record. A UI that *cannot quietly lose content* is a stronger claim than a
   spec sentence saying it must not.

3. **A generated view belongs in `extensions` — resolved.** The spike carried the
   view kind as `extensions["spike:view"]` because `interpretation.presentation`
   has no `view` field, and asked whether that was a gap or the answer. It is the
   answer: [issue #5](https://github.com/schmug/lenspub/issues/5) settled view
   selection as an `extensions` concern, and the manifest specification now says
   so normatively in
   [§5.6](../spec/lens-manifest.md#56-interpretation-required) and
   [§5.12](../spec/lens-manifest.md#512-extensions-optional), which works view
   selection as its motivating example and states what the placement costs.
   No field was added to `interpretation.presentation`; the spike's placement was
   right, though `spike:view` does not follow §5.12's SHOULD of a
   collision-resistant key.

4. **Reordering is the unresolved tension.** Timeline, source-compare, and
   priority-cards all change order. The `MUST NOT ... reorder` rule is normative
   in four places — [protocol §6.2](../spec/lenspub-protocol.md) and
   [§7.3](../spec/lenspub-protocol.md), [lens-engine §6.1](../spec/lens-engine.md),
   and the [Glossary](../GLOSSARY.md) — so under a literal reading these views are
   non-conformant, though nothing is ever hidden, removed, or rewritten. The spike
   does not resolve it: it labels every reordering view "reordered by lens" and
   keeps canonical order one click away. The proposed resolution is
   [ADR-0011](../adr/0011-overlay-invariants-bind-to-authored-content.md), under
   review in [issue #4](https://github.com/schmug/lenspub/issues/4).

5. **Honest degradation reads well.** Words the compiler cannot map are listed
   as dropped rather than guessed at, which mirrors the anchoring posture in
   ADR-0002 and makes the rule-based tier feel deliberate instead of limited.
