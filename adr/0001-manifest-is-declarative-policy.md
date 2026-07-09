# ADR-0001: The Lens Manifest is a declarative, model-agnostic policy document

**Status:** Accepted · 2026-07-09

## Context

The Lens Manifest is LensPub's primary exchange object, but the original handoff left its nature undefined. Three candidate shapes existed: (a) model artifacts — weights, adapters, or fine-tunes; (b) prompts — natural-language instructions for a specific model; (c) a declarative policy document — a structured, model-independent expression of interpretation intent.

Options (a) and (b) both bind the manifest to a particular model or model family, defeating portability, making diffs meaningless (weights don't diff usefully; prompts diff textually but not semantically), and violating the constitution's model-agnosticism requirement. They also make manifests uninspectable in practice.

## Decision

The Lens Manifest is a **declarative, model-agnostic policy document**. It expresses *intent* — topic priorities, source trust and distrust, presentation preferences, adaptation policies, domain scopes — in a structured schema (`schemas/lens-manifest.schema.json`). A Lens Engine *compiles* the manifest into whatever engine-specific artifacts it needs (rules, prompts, retrieval configuration, classifier thresholds). Compiled artifacts are engine-internal and are never the exchange object.

A Lens Manifest MUST NOT contain model weights, and MUST NOT consist of prompt text intended for direct execution by a model.

## Consequences

- Portability, diffability, and model-agnosticism follow directly: any conforming engine can consume any conforming manifest, and diffs are semantic (field-level) rather than textual.
- Manifests are human-inspectable, satisfying the transparency and explainability principles.
- Engines carry the complexity of compilation; the same manifest may produce different interpretation richness on different engines. This is accepted and made explicit through capability tiers (ADR-0004, Architecture).
- The schema becomes the protocol's most load-bearing artifact and is versioned with care.

## Alternatives considered

Portable prompts (rejected: model-bound, non-semantic diffs); portable adapters/LoRA (rejected: vendor- and architecture-bound, uninspectable); hybrid manifest-plus-prompt (rejected: the prompt half reintroduces every problem).
