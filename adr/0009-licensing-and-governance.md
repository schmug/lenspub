# ADR-0009: CC-BY 4.0 specification, Apache-2.0 code, personal open project with a lightweight change process

**Status:** Accepted · 2026-07-09

## Context

A standards proposal without explicit licensing and stewardship cannot be adopted: implementers need patent and copyright clarity, and contributors need to know how decisions are made. The project owner has chosen to run LensPub as a personal open project rather than immediately seeking a foundation or working-group home.

## Decision

- **Specification and documentation:** Creative Commons Attribution 4.0 International (CC-BY 4.0). Anyone may implement, redistribute, or build on the specification with attribution.
- **Reference implementation and all code (including schemas and the browser proof of concept):** Apache License 2.0, chosen over MIT for its express patent grant — meaningful for a protocol intended for multiple independent implementations.
- **Stewardship:** LensPub is a personal open project. The originator is the maintainer and final decision-maker. Changes to constitutional documents (`constitution/`, `/adr`) require a written proposal (issue or PR) with rationale, a visible review period, and an entry in the constitution's Change Log. Ordinary specification errata follow normal PR review.
- **Trajectory:** if adoption warrants, the roadmap contemplates migration to neutral stewardship (community group or foundation); the CC-BY/Apache-2.0 pairing is chosen partly because it survives that migration without relicensing.

## Consequences

- Implementers get immediate clarity; no CLA is required for v1 (inbound = outbound licensing).
- "Personal project" is stated honestly in GOVERNANCE.md rather than simulating a working group that doesn't exist — reviewers respect candor over theater.
- The provisional namespace `https://lenspub.org/ns/` remains provisional until the project's permanent home is registered.

## Alternatives considered

W3C Document License (rejected for now: fits documents inside W3C process, which this is not yet); MIT for code (rejected: no patent grant); GPL family (rejected: friction for commercial engine implementations contradicts adoption goals).
