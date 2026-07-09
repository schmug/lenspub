# ADR-0010: The five adaptation policies are defined as points on explicit parameters

**Status:** Accepted · 2026-07-09

## Context

The constitution names five adaptation policies — Locked, Conservative, Balanced, Adaptive, Explorer — and allows per-domain overrides. If the names are left as vibes, every engine will implement different behavior under the same label, breaking manifest portability exactly where users are most sensitive (how fast their lens changes).

## Decision

Adaptation policies are defined as named presets over three protocol-defined parameters:

| Parameter | Meaning |
|---|---|
| `proposalFrequency` | Maximum rate at which the engine may raise Lens Change Proposals (e.g., per week per domain scope) |
| `evidenceThreshold` | Minimum accumulated, explicit-feedback evidence required before a proposal may be raised |
| `autoAcceptCeiling` | The maximum proposal impact class that may be auto-accepted; everything above requires explicit user review |

Preset semantics (normative values in the Adaptation Model spec):

- **Locked** — no proposals at all (`proposalFrequency = 0`); the lens changes only by direct manual edit.
- **Conservative** — rare proposals, high evidence threshold, nothing auto-accepted.
- **Balanced** — moderate proposals, moderate threshold, nothing auto-accepted.
- **Adaptive** — frequent proposals, lower threshold, trivial-impact changes MAY auto-accept (with notification and one-tap rollback).
- **Explorer** — engine may additionally propose *exploratory* changes (novel domains, counter-preference suggestions); trivial and minor impact MAY auto-accept, always notified, always rollback-able.

Precedence: per-domain policy overrides lens-wide default; subscription-supplied policy suggestions never override the user's own settings. Auto-acceptance above the ceiling is a conformance violation. Even under Explorer, silent (un-notified) change remains prohibited — notification and rollback are unconditional.

## Consequences

- The same manifest produces the same *adaptation behavior* on every conforming engine — the portability that matters most.
- Custom policies are expressible by setting parameters directly; the five names are presets, not a closed enum.
- An impact classification for proposals (trivial/minor/major) must be defined in the Adaptation Model spec; it is, and it is deliberately coarse.

## Alternatives considered

Named policies without parameters (rejected: unportable vibes); a continuous "learning rate" scalar (rejected: users cannot reason about it, and it invites silent drift); engine-defined policies (rejected: defeats the point of user-owned stability).
