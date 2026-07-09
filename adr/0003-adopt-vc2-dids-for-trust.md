# ADR-0003: Verifiable Credentials 2.0 + DIDs for identity, signing, and trust

**Status:** Accepted · 2026-07-09

## Context

Shared lenses create an identity and trust problem: users must be able to verify who published a lens (expert, organization, partner), detect tampering, and revoke trust. The threat model names fake public lenses, lens poisoning, and signature verification. Hand-specifying "signed manifests" would mean designing key distribution, proof formats, and revocation from scratch. W3C Verifiable Credentials 2.0 became a W3C Recommendation in 2025, with VC Data Integrity and JOSE/COSE securing mechanisms, and DIDs provide decentralized, vendor-neutral identifiers.

## Decision

LensPub adopts **W3C Verifiable Credentials 2.0, Decentralized Identifiers (DIDs), and VC Data Integrity** wholesale for: publisher identity (Lens Publishers are DIDs), manifest signing (Signed Manifests carry Data Integrity proofs), publisher attestations (expert/organization credentials expressed as VCs), and revocation (VC status mechanisms).

Unsigned manifests remain valid for personal and local use; signature requirements attach to *publication and subscription*, per the Security Model. Engines MUST verify proofs on subscribed lenses and MUST surface verification status to the user.

## Consequences

- The trust model rests on a current W3C Recommendation rather than novel cryptographic design — the fastest path to credibility and to independent implementations.
- DID-method choice stays open (vendor neutrality); the reference implementation uses `did:web` and `did:key` for simplicity.
- The dependency adds implementation weight to publishing/subscribing engines; capability tiers allow minimal engines to omit subscription support entirely.

## Alternatives considered

Raw JWS over manifest JSON (rejected: no identity or revocation story); PGP-style web of trust (rejected: usability, tooling decline); platform accounts (rejected: reintroduces platform dependence).
