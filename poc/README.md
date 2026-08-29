# LensPub Reference Engine — Browser Proof of Concept

A Manifest V3 browser extension that demonstrates the LensPub protocol end to end at the **rule-based capability tier**: it loads a user-owned [Lens Manifest](../schemas/lens-manifest.schema.json), compiles it into engine-internal rules, interprets rendered pages into an [Interpretation Result](../schemas/interpretation-result.schema.json), and renders the result as an inspectable, reversible overlay — every annotation carrying a Reasoning Trace and every result a Reproducibility Envelope.

Code in this directory is licensed **Apache-2.0** (see [../LICENSE-CODE](../LICENSE-CODE)); the surrounding specification is CC-BY 4.0. Vanilla JavaScript, no build step, no dependencies, no remote code, and **no network I/O of any kind** — the only `fetch()` calls load the extension's own bundled resources (`chrome-extension://` URLs), consistent with the local-only default of [ADR-0005](../adr/0005-local-only-default.md). The architecture note for this PoC is [../architecture/reference-implementation.md](../architecture/reference-implementation.md).

## Install (load unpacked)

1. Open `chrome://extensions` in Chrome or a Chromium-based browser (Manifest V3 required).
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this `poc/` directory.
4. The toolbar action "LensPub Reference Engine (PoC)" appears. No account, no configuration, no network access.

Optional, only if you want the overlay on local `file://` pages: open the extension's **Details** page and enable **Allow access to file URLs**.

## Try it

1. Click the toolbar action to open the popup. It shows the active lens — the bundled sample [`lenses/avery-daily.json`](lenses/avery-daily.json) ("Avery Daily Lens" v1.4.2, adaptation policy `balanced`) — with a read-only manifest viewer.
2. Click **Open demo page**. A fictional article from "The Example Journal" opens and the overlay activates:
   - yellow **highlights** where the article matches the lens priorities *local-first software*, *school cybersecurity*, and *data privacy*;
   - a blue **evidence indicator** on the sentence claiming "73 percent" with no citation link (its reasoning trace states plainly that this is a shallow heuristic, not a judgment of the claim);
   - no indicator on the audit paragraph, whose numbers sit next to citation links;
   - an **S** badge in the floating lens indicator (bottom right) for the document-level extractive summary.
3. Click any highlight, margin badge, or dock badge to open the **explanation card**: annotation kind, body, the full Reasoning Trace, the basis (for evidence-class annotations), the anchor status (`exact` / `degraded` / `unanchored` / `document`), the manifest fields that triggered it (JSON Pointers), and the Reproducibility Envelope (engine, version, tier, execution location, model — `none (rule-based)`).
4. The floating indicator shows the lens name, `lensVersion`, and a `local` execution badge; **Hide** toggles all overlays, **×** dismisses them entirely — highlights unwrap and the page's original text nodes are restored exactly.
5. Back in the popup: per-tab annotation counts by kind, **Export manifest** (JSON download), **Import manifest…** (rejects anything that fails the normative manifest schema, with readable errors), and **Reset to bundled lens**.

The overlay also runs on ordinary `http(s)` pages (content script at `document_idle`). On the demo page the *trusted-origin* evidence indicator does not fire — the page is not actually served from `example-journal.example`; that rule is exercised by the test suite. On pages whose markup whitespace differs from the extracted rendered text you will see anchors marked `degraded`: that is the robust-anchoring fallback of [ADR-0002](../adr/0002-profile-web-annotation.md) working, not an error.

## Run the tests

```
npm install && npm test
```

from the repository root (equivalently, `node poc/test/run-tests.mjs` once dependencies are installed). Plain Node asserts over the pure engine modules, then Ajv validation of the produced Interpretation Result and the bundled lens against the normative schemas in [`../schemas/`](../schemas/). Requires Node 18+ and the Ajv devDependencies declared in the root [`package.json`](../package.json); the extension itself needs neither.

That suite tests this engine's internals. The specification-level bar any engine can meet is the [conformance suite](../conformance/README.md) — `npm run conformance` runs it against [`conformance-adapter.mjs`](conformance-adapter.mjs), which declares the `manifest-consumer`, `anchor-resolver`, and `lens-engine` roles at the `rule-based` tier. The vectors for the roles and tiers this PoC does not implement report **skipped**, never passed.

## What each component demonstrates

| Path | Component (Glossary term) | Demonstrates |
|---|---|---|
| `manifest.json` | — | MV3 packaging: module service worker, content script, popup, `storage` permission only |
| `engine/compile.js` | Manifest Compiler | Declarative manifest → engine-internal rules ([ADR-0001](../adr/0001-manifest-is-declarative-policy.md)); import validation |
| `engine/schema-check.js`, `engine/lens-manifest.schema.js` | Manifest validator | Dependency-free check against a bundled verbatim copy of the normative schema ([Lens Manifest §2](../spec/lens-manifest.md)) |
| `conformance-adapter.mjs` | Conformance adapter | This engine's side of the seam in [`../conformance/ADAPTER.md`](../conformance/ADAPTER.md) |
| `engine/interpret.js` | Interpretation Pipeline | Rule-based interpretation producing schema-exact Interpretation Results with Reasoning Traces; evidence kinds carry a `basis`, never a verdict ([ADR-0007](../adr/0007-epistemic-stance.md)) |
| `engine/anchor.js` | Anchor Manager | W3C TextQuoteSelector production and the exact → degraded → unanchored fallback ([ADR-0002](../adr/0002-profile-web-annotation.md)) |
| `engine/envelope.js` | Reproducibility Envelope | Engine id/version/tier and execution location on every result ([ADR-0004](../adr/0004-reproducibility-envelope.md)) |
| `engine/model-engine.stub.js` | Lens Engine (higher tiers) | The documented seam where a local-model tier would slot ([../spec/lens-engine.md](../spec/lens-engine.md)) |
| `content/content.js` + `content/overlay.css` | Overlay Annotation rendering | Post-render overlay stage ([ADR-0008](../adr/0008-interpretation-is-overlay-stage.md)): wrap-only highlighting, clean unwrap, Shadow-DOM-isolated UI, explanation cards, lens indicator |
| `background/service-worker.js` | Engine host | Manifest ownership, one-time compilation, interpret requests, per-tab state |
| `popup/` | Manifest Consumer UI | Inspect / import / export the manifest; counts by kind; execution-location badge |
| `lenses/avery-daily.json` | Lens Manifest | The repo's running example persona; validates against the normative schema |
| `demo/demo.html` | — | Self-contained test article engineered to exercise every rule |
| `test/run-tests.mjs` | — | Unit tests plus Ajv validation against the normative schemas |

The engine modules under `engine/` are pure and DOM-free: the same files run inside the extension's service worker and under Node in the test suite.

## What this PoC does NOT implement

This is a deliberately narrow reference. It omits, with pointers to where each capability is specified:

- **Subscriptions and published lenses** — no fetching, composing, or pinning of remote lenses ([../spec/lenspub-protocol.md](../spec/lenspub-protocol.md), [../spec/lens-manifest.md](../spec/lens-manifest.md)). The manifest's `subscriptions` array is ignored if present.
- **Signing and verification** — no DIDs, no Verifiable Credential Data Integrity proofs, no publisher trust ([ADR-0003](../adr/0003-adopt-vc2-dids-for-trust.md), [../security/security-model.md](../security/security-model.md)). `proof` members are ignored; DID-valued source origins never match.
- **Adaptation** — no feedback capture, no Lens Change Proposals, no shadow evaluation, no version history writing ([../spec/adaptation-model.md](../spec/adaptation-model.md), [ADR-0010](../adr/0010-adaptation-policies-parameterized.md)). The manifest never changes except by explicit import; `adaptation.defaultPolicy` is displayed, not enforced, because nothing here adapts.
- **Lens Diff** — no diff computation or rendering ([../spec/lens-diff.md](../spec/lens-diff.md), [../schemas/lens-diff.schema.json](../schemas/lens-diff.schema.json)).
- **Model tiers** — no local-model, hosted-model, or hybrid interpretation; `engine/model-engine.stub.js` documents the seam and throws ([../spec/lens-engine.md](../spec/lens-engine.md)).
- **Remote inference and its opt-in flow** — there is no remote execution path at all, hence no per-Domain-Scope opt-in UI, no `optInScope`, and no trust-boundary crossing to make visible ([ADR-0005](../adr/0005-local-only-default.md), [../security/privacy-model.md](../security/privacy-model.md)).
- Also out of scope: Domain Scope classification of content, counterpoints and primary-source expansion (kinds exist in the schema; this tier never emits them), C2PA consumption, Solid hosting, AT Protocol subscription transport, and SPA re-interpretation on client-side navigation.

## Known PoC limits

- Extraction caps at 200 blocks; results cap at 50 annotations.
- The uncited-claim rule is a stated heuristic (numbers/percentages in linkless blocks) and will both miss claims and flag benign sentences; its reasoning trace says so.
- Badge positions are recomputed on resize but not on arbitrary DOM mutation.
- Interpretation runs once per page load at `document_idle`.
