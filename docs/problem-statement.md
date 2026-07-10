# Problem Statement

**Status:** Draft v0.1 · **Date:** 2026-07-09 · **License:** CC-BY 4.0

This document states the problem LensPub exists to solve and derives the requirements any solution must satisfy. It is a vision-level document and contains no normative requirements; the companion documents are the [Vision](vision.md) and the [Design Principles](design-principles.md).

## The cost of producing plausible content has collapsed

For most of history, producing a credible-looking piece of information cost meaningful human effort — research, writing, editing, production. That cost was itself a crude quality gate: not everything worth doubting got made. Generative AI has removed it. Text that reads like journalism, images that read like photographs, voices that read as familiar, and video that reads as witnessed can now be produced at near-zero marginal cost, in unlimited volume, targeted and iterated automatically.

The critical asymmetry is between generation and evaluation. Producing a plausible claim is now nearly free; evaluating it — checking provenance, finding the primary source, noticing what is missing — still costs a human minutes of attention per item. An economy in which fabrication is free and verification is expensive drowns individual judgment by arithmetic alone. Every prior collapse in creation cost was answered by a new quality gate: publishers for print, search engines for the web, recommendation algorithms for social media. The gate for the generative-AI era has not been built, and the volumes involved make its absence more dangerous than in any previous era.

## The incumbent gate: platform ranking, and its four defects

Today, the closest thing to that gate is platform ranking — the recommendation and feed-ordering systems of large platforms, increasingly augmented with machine-generated summaries. Whatever its merits, it has four structural defects that no amount of incremental improvement can remove, because they follow from who owns it.

**It is opaque.** No user can inspect why an item was shown, buried, or summarized the way it was. The ranking function is a trade secret; the explanations offered ("you follow similar topics") are simplifications produced by the same party whose behavior they purport to explain. There is no artifact a user, auditor, or researcher can read.

**It is misaligned.** Platform ranking is optimized for engagement and advertising revenue, because advertisers, not readers, pay for it. Engagement correlates with outrage, novelty, and confirmation at least as strongly as with quality. The gate's operator profits when the gate's judgment diverges from the reader's interest — a misalignment that is structural, not a matter of bad actors.

**It is non-portable.** Years of a user's signals — what they valued, corrected, dismissed — are locked inside each platform as its asset. Leaving means abandoning one's accumulated filter and retraining a new one from nothing. The user's own curation history functions as a switching cost held against them.

**It is concentrated.** A handful of ranking systems gate the effective attention of billions of people. Concentration makes each system a single point of manipulation (one adversarial discovery scales to everyone), a single point of failure, and a homogenizing force on what humanity collectively notices.

Underneath all four defects is one fact: users cannot inspect their filter, cannot correct it except through signals the platform chooses to accept and interpret, and cannot carry it anywhere. The most consequential piece of personal intellectual infrastructure a modern person has is neither personal nor infrastructure — it is a rented service, tuned by its owner.

## The harms

These defects produce four distinct harms.

**Epistemic dependence.** Delegating filtering is not itself pathological — everyone relies on editors, reviewers, and experts. The pathology is delegation *without accountability*: the platform's judgment of what deserves your attention cannot be audited, questioned in detail, or corrected on your terms. Over years, the habit of receiving a pre-filtered world from an uninspectable source erodes the practiced capacity to filter at all.

**Invisible drift.** Ranking systems change constantly — new models, new objectives, quiet experiments. Each change silently alters what millions of people see, with no notice, no changelog, and no way for an individual to detect that their information environment shifted, attribute the shift, or roll it back. A person's effective worldview input can be materially retuned overnight without their knowledge.

**Lock-in.** Because the filter is non-portable, exit is punished. Network effects already bind users to platforms; the accumulated, unexportable curation state binds them again. A user who dislikes how the gate treats them has no meaningful exit right, and the gate's owner knows it.

**Surveillance-funded curation.** The incumbent gate pays for itself by watching. Improving the filter and deepening the behavioral dossier are the same activity under the engagement model: the gate gets better *because* it observes more of what you read, linger on, and return to. Curation quality and surveillance depth are structurally coupled, so users are forced to buy the former with the latter.

## Why a protocol, not a better app

It is tempting to answer with a product: a browser extension or reader app with cleaner incentives and better filters. A better app is not a solution; it is a smaller instance of the problem, deferred. If the filter is a single implementation, its biases and blind spots are systemic for everyone who uses it. If the filter's format is proprietary, users who invest in it are locked in exactly as before — the app can pivot, be acquired, or die, and the filter dies with it. And if the app succeeds at scale, its funding pressures bend it toward the same engagement-and-surveillance model, because nothing structural prevents that.

The defects identified above are ownership and structure defects, and only a protocol addresses ownership and structure. A protocol makes the filter a *document with an open format* rather than a service: the [Lens Manifest](../spec/lens-manifest.md) is a declarative, model-agnostic policy object ([ADR-0001](../adr/0001-manifest-is-declarative-policy.md)) that any conforming [Lens Engine](../spec/lens-engine.md) can apply. That yields three properties no app can offer:

*Interoperability.* Many independent engines — rule-based, local-model, hosted, hybrid — consume the same manifest, so publishers, tools, and researchers can target a format instead of a vendor, and users can choose engines on merit.

*Exit rights.* Because the manifest is portable, versioned, and diffable, leaving any engine or vendor costs nothing epistemically: the user's filter travels with them. Exit rights, not vendor virtue, are what keep implementations honest over decades.

*Independent implementations.* An openly specified protocol ([CC-BY 4.0 specification, Apache-2.0 reference code, ADR-0009](../adr/0009-licensing-and-governance.md)) can be implemented, audited, and forked by anyone. Inspection becomes a property of the format rather than a promise of a company. The durable layers of the internet — mail, the web itself — survived their original implementations precisely because they were protocols; LensPub applies the same lesson to interpretation, profiling existing standards ([W3C Web Annotation](https://www.w3.org/TR/annotation-model/), [Verifiable Credentials and DIDs](https://www.w3.org/TR/vc-data-integrity/)) rather than inventing parallel ones.

## Requirements the solution must satisfy

The analysis above yields ten requirements. They map one-to-one to the guiding principles fixed in the [constitution](../constitution/DESIGN_HANDOFF.md) and developed in [Design Principles](design-principles.md).

| # | Requirement | Guiding principle |
|---|---|---|
| 1 | The filter is an object the user possesses — inspectable, modifiable, and revocable by no one else. | User ownership |
| 2 | The filter's contents and behavior are readable by its owner; nothing about it is a trade secret. | Transparency |
| 3 | The filter works on the user's device with no network dependency; remote services are enhancements, never requirements. | Local-first design |
| 4 | Every act of interpretation states which rule or signal produced it. | Explainability |
| 5 | Every change to the filter can be undone; every prior version can be restored. | Reversibility |
| 6 | The filter moves intact between devices, applications, and implementations. | Portability |
| 7 | The formats and mechanisms are openly specified, building on existing standards, so anyone may implement them. | Open standards |
| 8 | The filter never exfiltrates reading behavior; sharing a filter never shares history. | Privacy by default |
| 9 | No model, browser, or company is privileged by the design. | Vendor neutrality |
| 10 | The filter evolves only with its owner's explicit consent; automation proposes, the human decides. | Human agency over automation |

A system satisfying all ten is no longer a rented gate. It is the reader's own — which is the point. The [Vision](vision.md) describes what the world looks like when such a system exists; the specifications in this repository describe how to build one.
