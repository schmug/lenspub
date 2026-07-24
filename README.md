# LensPub

**An open protocol for publishing, exchanging, and applying user-owned interpretation layers.**

*Specification draft v0.1 · Documentation CC-BY 4.0 · Code Apache-2.0 · Status: public draft for discussion*

---

Every era of cheaper information creation has forced society to invent a new quality gate. Books got publishers and editors. The web got search engines. Social media got platform recommendation algorithms. Generative AI has collapsed the cost of producing plausible content — and the gate for this era is still unresolved.

LensPub's proposal is that the next quality gate should belong to the **individual, not the platform**. Every person should own, inspect, modify, version, and share their own interpretation layer: a portable policy — a **lens** — that decides what gets highlighted, summarized, flagged for missing evidence, or paired with counterpoints as they read, applied by an engine that runs locally by default, explains every decision it makes, and never changes silently.

LensPub standardizes that layer. It is not a truth engine, not censorship software, not a recommendation algorithm, and not tied to any AI vendor or browser. Original content is never rewritten — interpretation is layered above it, never substituted for it.

## How it works

A **Lens Manifest** is the exchange object: a declarative, model-agnostic policy document expressing what you care about — topic priorities, source trust, evidence requirements, presentation preferences — never model weights, never a prompt, and structurally free of your browsing history. A **Lens Engine** (rule-based, local-model, hosted-model, or hybrid) compiles the manifest and overlays annotations on rendered content, anchored using the W3C Web Annotation vocabulary, each carrying a reasoning trace ("why am I seeing this?") and a reproducibility envelope recording exactly what produced it. Lenses evolve only through a **proposal workflow** — explicit feedback accumulates into reviewable change proposals under user-set adaptation policies (Locked → Explorer) — and every accepted change is a new version you can diff and roll back. Published lenses (expert, organization, partner) are signed with W3C Verifiable Credentials and composed as subscriptions that advise your lens but never override it.

## Reading order

New here? Read these in order:

1. [Vision](docs/vision.md) — the thesis and what the world looks like if this works
2. [Problem Statement](docs/problem-statement.md) — why platform-owned quality gates fail, and why the fix is a protocol
3. [The worked example](examples/worked-example/README.md) — one article, one lens, every annotation explained end to end
4. [LensPub Protocol](spec/lenspub-protocol.md) — the core specification

## Repository guide

| Area | Contents |
|---|---|
| [`constitution/`](constitution/DESIGN_HANDOFF.md) | The project constitution — the authoritative design handoff all documents derive from |
| [`docs/`](docs/) | [Vision](docs/vision.md) · [Problem Statement](docs/problem-statement.md) · [Design Principles](docs/design-principles.md) · [Prior Art](docs/prior-art.md) · [User Experience](docs/user-experience.md) · [Legal Considerations](docs/legal-considerations.md) · [Roadmap](docs/roadmap.md) |
| [`spec/`](spec/) | [LensPub Protocol](spec/lenspub-protocol.md) · [Lens Manifest](spec/lens-manifest.md) · [Lens Engine](spec/lens-engine.md) · [Adaptation Model](spec/adaptation-model.md) · [Lens Diff](spec/lens-diff.md) |
| [`architecture/`](architecture/) | [Reference Architecture](architecture/architecture.md) · [Reference Implementation](architecture/reference-implementation.md) |
| [`security/`](security/) | [Security Model](security/security-model.md) · [Privacy Model](security/privacy-model.md) · [Threat Model](security/threat-model.md) |
| [`adr/`](adr/README.md) | The ten Architecture Decision Records freezing the constitutional decisions |
| [`schemas/`](schemas/) | JSON Schemas for the three exchange objects |
| [`examples/`](examples/) | Five example manifests, an example diff, and the [end-to-end worked example](examples/worked-example/README.md) |
| [`poc/`](poc/README.md) | Browser proof of concept — a working MV3 extension implementing the rule-based engine tier |
| [`GLOSSARY.md`](GLOSSARY.md) | Normative vocabulary used across every document |

## Try it

The proof of concept is a dependency-free Chrome/Chromium extension. Load `poc/` unpacked (chrome://extensions → Developer mode), open `poc/demo/demo.html`, and click any highlight to see the reasoning trace and reproducibility envelope behind it. Instructions: [`poc/README.md`](poc/README.md).

The repository's two Node entry points — the schema validator and the engine test suite — need Ajv. Install once (Node 18+):

```
npm install
```

Then validate every JSON example against the schemas with `npm run validate`, and run the engine unit tests with `npm test`. Both scripts are plain `node` invocations (`scripts/validate-examples.mjs` and `poc/test/run-tests.mjs`) and can be called directly. The extension itself has no dependencies and no build step.

## Standards posture

LensPub profiles [W3C Web Annotation](https://www.w3.org/TR/annotation-model/) (overlay anchoring) and [W3C Verifiable Credentials 2.0](https://www.w3.org/TR/vc-overview/) + [DIDs](https://www.w3.org/TR/did-core/) (identity and signing); it complements [Solid](https://solidproject.org/) (optional hosting profile), [AT Protocol](https://atproto.com/) (reference subscription binding), and [C2PA](https://c2pa.org/) (consumed provenance signal); it replaces nothing. What LensPub itself claims as new is deliberately small: the declarative interpretation-policy object, the parameterized adaptation-governance model, the reproducibility envelope, and the history-free sharing construction. See [Prior Art](docs/prior-art.md).

## Status and participation

This is a v0.1 public draft authored to be discussed, implemented, and criticized. It is a personal open project ([GOVERNANCE.md](GOVERNANCE.md)); substantive proposals are welcome as issues ([CONTRIBUTING.md](CONTRIBUTING.md)). The success criteria are concrete: an engineering team can begin implementation from these documents, multiple independent implementations are possible, and nothing requires reference to a specific AI model.

## License

Documentation and specifications: [CC-BY 4.0](LICENSE-SPEC). Code, schemas, and the proof of concept: [Apache-2.0](LICENSE-CODE). Details: [LICENSE.md](LICENSE.md).
