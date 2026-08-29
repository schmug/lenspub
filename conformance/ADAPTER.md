# The Conformance Adapter Interface

**Status:** Draft v0.1 · **Date:** 2026-08-28

One documented interface. Implement it beside your engine and run the suite; you never fork the suite, and you never add anything to it.

```
npm run conformance -- --adapter ./path/to/your-adapter.mjs
```

Start from [`adapters/example-adapter.mjs`](adapters/example-adapter.mjs), which declares no roles and therefore skips everything — worth running once, because it is what "credited with nothing you did not demonstrate" looks like. [`../poc/conformance-adapter.mjs`](../poc/conformance-adapter.mjs) is the reference engine's real one, in 50 lines.

## The module

An adapter is an ES module whose default export is one object: four declaration fields and a method per role.

```js
export default {
  name: 'my-engine',
  version: '2.1.0',
  capabilityTier: 'local-model',      // rule-based | local-model | hosted-model | hybrid
  roles: ['manifest-consumer', 'lens-engine'],

  validateManifest(document) { /* ... */ },
  interpret({ manifest, content }) { /* ... */ }
};
```

Every method may be `async`; the runner awaits all of them. A method that throws fails its vector with the thrown message rather than ending the run.

### `capabilityTier`

Exactly one, per [Lens Engine §4.1](../spec/lens-engine.md) — an engine declares one tier per deployment. Vectors carrying `requiresTier` run only for the tiers they name and are **skipped** for the rest, because reduced richness at a lower tier is conforming and crediting an engine with a requirement it was never asked to meet would misstate what was tested.

### `roles`

Declare only what you implement. A vector whose role is absent from this list is skipped. Declaring a role whose method is missing is a load-time error, not a skip: the suite will not let you claim a role and then not be asked about it.

| Role | Methods required | Conformance target |
|---|---|---|
| `manifest-consumer` | `validateManifest` | [Lens Manifest §2](../spec/lens-manifest.md), [protocol §7.1](../spec/lenspub-protocol.md) |
| `anchor-resolver` | `resolveAnchor` | [Lens Engine §5](../spec/lens-engine.md) |
| `lens-engine` | `interpret` | [Lens Engine §2, §4.2](../spec/lens-engine.md) |
| `adaptation-engine` | `resolvePolicy`, `classifyImpact`, `disposeProposal` | [Adaptation Model §2](../spec/adaptation-model.md) |
| `differ` | `diff` | [Lens Diff §2](../spec/lens-diff.md) |

## The methods

### `validateManifest(document) → { accepted, errors? }`

`document` is a parsed JSON value — not necessarily an object, and not necessarily a manifest. Return `accepted: false` for anything that fails validation against [`../schemas/lens-manifest.schema.json`](../schemas/lens-manifest.schema.json), including a `lenspub` member naming a version you do not implement. `errors` is optional and free-form; the suite prints it when a rejection was not expected, and constrains its wording not at all.

Both directions are tested. Accepting a document the schema rejects fails the negative vectors; rejecting a conforming manifest, or failing on an `extensions` entry you do not recognise, fails the positive ones.

### `resolveAnchor({ content, selector }) → { status, start, end }`

`content` is a **flat text run** and `selector` is one W3C Selector, usually a `TextQuoteSelector`. `status` is `exact`, `degraded`, `unanchored`, or `document`; `start` and `end` are character offsets into `content`, and are `-1` when nothing was located. Vector content is ASCII, so offsets are unambiguous across languages.

Because there is no element structure at this seam, step 3 of the ladder in [Lens Engine §5.2](../spec/lens-engine.md) — attaching to the nearest stable ancestor — does not apply: an engine that cannot locate the quote reports `unanchored`. Step 2 does apply and remains OPTIONAL, so declining to fuzzy-match and reporting `unanchored` is as conforming as attempting one and reporting `degraded`. What no engine may do is report `exact` for a span the selector did not verifiably identify; the suite reports that as a conformance violation rather than a mismatch.

### `interpret({ manifest, content }) → InterpretationResult`

`content` is `{ source, title?, blocks: [{ text, tag?, linkCount? }] }` — rendered text as a host user agent would expose it after content, presentation, and behaviour have run ([ADR-0008](../adr/0008-interpretation-is-overlay-stage.md)). It is pre-extracted so the suite needs no DOM and no browser; supply it to your engine however your engine normally receives rendered content.

Return an Interpretation Result conforming to [`../schemas/interpretation-result.schema.json`](../schemas/interpretation-result.schema.json). Beyond whatever a vector asks, the suite applies the unconditional invariants of [protocol §7.3](../spec/lenspub-protocol.md) to **every** result it obtains:

- it validates against the result schema;
- every annotation carries a non-empty `reasoning`;
- every evidence-class annotation (`evidence-indicator`, `counterpoint`, `primary-source`) carries a non-empty `basis` ([ADR-0007](../adr/0007-epistemic-stance.md));
- an `execution.location` of `remote` names an `optInScope` the supplied manifest actually opted in ([ADR-0005](../adr/0005-local-only-default.md));
- no annotation reports anchor status `exact` for a quote absent from the supplied content.

### `resolvePolicy({ manifest, domains }) → parameters`

`domains` is the list of Domain Scope ids the content classified into; an empty list means no scope matched and the lens-wide default governs. Return the **effective** parameters after preset lookup, explicit-parameter override, and per-domain precedence:

```js
{ proposalFrequency: 1, evidenceThreshold: 6, autoAcceptCeiling: 'none', exploratoryProposalsPermitted: false }
```

Use `null` for `evidenceThreshold` where the policy makes it inapplicable. When `domains` names two or more scopes with differing policies, combine parameter-wise and most restrictively — lowest frequency, highest threshold, lowest ceiling ([Adaptation Model §6](../spec/adaptation-model.md)) — rather than picking whichever single policy looks stricter overall.

### `classifyImpact({ change }) → 'trivial' | 'minor' | 'major'`

`change` is one change object: `{ op, path, before?, after? }`. Classify per [Adaptation Model §4](../spec/adaptation-model.md). Engines MUST classify no lower than those rules and MAY classify more severely, so the vectors assert a **minimum**: over-classification passes, under-classification fails. Under-classification is what lets a change slip beneath an auto-accept ceiling, which is why the suite reports it as a violation.

### `disposeProposal({ policy, proposal }) → { disposition }`

`policy` is the effective parameter object already in force for the content's Domain Scope — the suite supplies it, so this method is not asked to resolve it. `proposal` is `{ impact, exploratory?, origin?, subscriptionTrust?, evidenceCount? }`, where `origin` is `user-feedback` or `subscription-update`.

Return one of:

| `disposition` | Meaning |
|---|---|
| `auto-accept` | Applied without review — always notified, always one-tap rollback-able ([Adaptation Model §3.5](../spec/adaptation-model.md)) |
| `require-review` | Surfaced to the user for an explicit decision |
| `must-not-raise` | The policy forbids raising the proposal at all |

`must-not-raise` is a real answer, not an error: under `locked`, no feedback-driven proposal is ever raised, and reporting `require-review` there means the engine raised one that `locked` promised it would not. Returning `auto-accept` above the effective ceiling is the case [Adaptation Model §2](../spec/adaptation-model.md) names a conformance violation outright, and the suite labels it as one.

### `diff({ from, to }) → { refused, reason?, diff? }`

Refusal is a first-class outcome. Return `{ refused: true, reason }` — producing no diff at all — for any input containing a field the manifest schema does not define. Stripping the member and diffing the remainder is the specific behaviour [Lens Diff §4](../spec/lens-diff.md) rule 2 prohibits: an unrecognised field is exactly where history-derived data would hide, and a differ that reads past it becomes the component that renders it into a review screen.

Otherwise return `{ refused: false, diff }` with a Lens Diff conforming to [`../schemas/lens-diff.schema.json`](../schemas/lens-diff.schema.json). Each change carries `op`, `path` (an RFC 6901 pointer), `category`, `impact`, and a `summary` — the member a renderer shows when it shows only one thing.

## Engines not written in JavaScript

Use [`adapters/subprocess-adapter.mjs`](adapters/subprocess-adapter.mjs). It starts your engine as a child process and exchanges newline-delimited JSON over stdin and stdout, so the only thing you write is a read-eval-print loop in your own language.

```
LENSPUB_CONFORMANCE_ENGINE="python3 engines/mine/conformance_engine.py" \
  npm run conformance -- --adapter conformance/adapters/subprocess-adapter.mjs
```

One request object per line, answered in order:

```
→ {"op":"describe"}
← {"ok":true,"result":{"name":"my-engine","version":"2.1.0","capabilityTier":"rule-based","roles":["differ"]}}
→ {"op":"diff","input":{"from":{…},"to":{…}}}
← {"ok":true,"result":{"refused":false,"diff":{…}}}
→ {"op":"classifyImpact","input":{"change":{"op":"remove","path":"/interpretation/priorities/2"}}}
← {"ok":false,"error":"not implemented"}
```

`describe` is sent once at startup and its `roles` govern skipping exactly as an in-process adapter's do. Every other `op` is a method name from this document, with `input` as its argument object — except `validateManifest`, whose argument arrives as `input.document`. Answer `{"ok":true,"result":…}` or `{"ok":false,"error":…}`; an error fails that vector and is never swallowed. Anything on stderr is passed through untouched for debugging.

The vectors under [`vectors/`](vectors/) are plain JSON with no JavaScript in them, so a runner in another language can consume them directly if you would rather not use this one. [`vectors/conformance-vector.schema.json`](vectors/conformance-vector.schema.json) is their normative shape, and [README.md](README.md) documents the eight `check` kinds and what each `expect` means.
