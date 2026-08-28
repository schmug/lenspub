# Security Policy

LensPub is a specification project with one proof-of-concept implementation, so
"a security issue" here means two quite different things. Please use the route
that matches.

## A vulnerability in the proof-of-concept code

Code under `poc/`, `scripts/`, and `spike/` is ordinary software and is handled
the ordinary way. **Report it privately** through GitHub's private vulnerability
reporting on this repository (the **Report a vulnerability** button under the
Security tab) rather than as a public issue.

Please include what you have: affected files, the conditions required, and the
impact. A working proof of concept helps but is not required. You will get an
acknowledgement, and the report stays private until there is a fix or a decision
that no fix is needed.

Scope note: `poc/` is a deliberately narrow reference that omits signing,
subscriptions, adaptation, and all model tiers — see the "What this PoC does NOT
implement" section of [`poc/README.md`](poc/README.md). A missing feature is not a
vulnerability. `spike/` is throwaway demonstration code and is not intended for
any real deployment.

## A weakness in the protocol design

A flaw in the *specification* — an attack the threat model misses, an invariant
that does not hold, a privacy property that can be defeated by construction — is
the most valuable thing this project can receive, and it is **not** an embargoed
secret. There is no deployed system to protect and no users at risk; a design
flaw discussed in the open gets fixed before anyone implements it.

Open a normal public issue. Read
[`security/threat-model.md`](security/threat-model.md),
[`security/security-model.md`](security/security-model.md), and
[`security/privacy-model.md`](security/privacy-model.md) first, and say which
stated assumption or invariant your finding breaks. If your finding also affects
the PoC's code, use the private route above and reference it.

If you are unsure which category something falls into, use the private route.
Escalating from private to public is easy; the reverse is not.

## Supported versions

This is a **v0.1 public draft**. There are no released versions, no supported
version matrix, and no backport policy. Fixes land on `main`.

## What this project can promise

LensPub is a personal open project with one maintainer
([GOVERNANCE.md](GOVERNANCE.md)). There is no security team and no response-time
commitment. What is committed to is the same thing GOVERNANCE §5 commits to
generally: an honest answer, including "this is a real problem and it is not
fixed yet."
