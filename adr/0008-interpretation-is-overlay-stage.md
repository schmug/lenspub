# ADR-0008: "Interpretation layer" is precisely a user-agent-side, post-render overlay stage

**Status:** Accepted · 2026-07-09

## Context

The original handoff framed LensPub as adding an "Interpretation" layer to a web stack of "Transport / Content / Presentation / Behavior." That stack mixes a network concept with document roles and is not a canonical model; standards reviewers would attack a loose layer claim, and implementers need to know *where* interpretation actually executes.

## Decision

The phrase "interpretation layer" is retained as conceptual framing in vision-level documents. Normatively, interpretation is defined as a **user-agent-side, post-render overlay stage**: it executes on the user's device (or user agent), after the document has been rendered, operating on the DOM and accessibility tree, producing overlays that are visually and semantically *above* content without mutating it. In the browser reference implementation this is a content-script stage; the definition deliberately generalizes to any user agent (e-readers, feed clients, OS-level agents) that exposes a rendered-content tree.

Anchoring to the accessibility tree as well as the DOM is REQUIRED consideration in the Architecture spec, both for robustness and because overlays must not degrade assistive-technology experiences.

## Consequences

- The architectural claim survives review: LensPub claims a *stage in the user agent*, not a new layer of the network stack.
- The definition pins the trust story: interpretation happens on the user's side of every boundary by default (composes with ADR-0005).
- System-wide interpretation (beyond the browser) remains a roadmap direction with a coherent definition already in place.

## Alternatives considered

Claiming a literal new web layer (rejected: technically indefensible); proxy/middlebox interpretation (rejected: violates local-first and creates a surveillance point); build-time/publisher-side interpretation (rejected: returns control to publishers — the opposite of the thesis).
