# Contributing to LensPub

Thank you for considering a contribution. LensPub is a specification repository first and a codebase second; most valuable contributions are careful readings that find defects. This document explains how to contribute effectively. Decision-making authority and the amendment process are defined in [GOVERNANCE.md](GOVERNANCE.md); please read it first.

## Discussion first

For **substantive specification changes** — anything that could change what a conforming implementation does — open an issue describing the problem and your proposed direction *before* writing a pull request. This protects your time (the maintainer can tell you early whether a direction conflicts with a settled decision) and keeps design rationale in a searchable public record. Changes that touch [`constitution/`](constitution/) or [`adr/`](adr/) additionally require the constitutional process in [GOVERNANCE.md](GOVERNANCE.md), including a 14-day visible review period.

**Editorial fixes** — typos, broken links, formatting — can go straight to a pull request.

## Pull request conventions

- One concern per PR. A typo sweep and a normative change never share a PR.
- Reference the issue the PR resolves, and state rationale in the description: what problem, what alternatives, which documents and ADRs are affected.
- If a change affects multiple documents (for example, prose in `spec/` and a schema in `schemas/`), update all of them in the same PR so the repository never merges into an inconsistent state.
- Keep diffs reviewable; large mechanical changes should be separated from judgment changes.

## Style rules for specification prose

The repository's register is IETF RFC / W3C specification: precise, sober, prose-first. No marketing language, no emojis, no exclamation marks. Specifically:

- **Normative keywords.** Documents under `spec/`, `security/`, and `architecture/` use BCP 14 keywords (MUST, SHOULD, MAY, and companions) in capitals, interpreted per [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) — and only in capitals when normative. Documents under `docs/` do not use BCP 14 keywords at all.
- **Vocabulary.** Use [GLOSSARY.md](GLOSSARY.md) terms exactly — it is always "Lens Manifest," never "lens file" or "lens profile"; "Overlay Annotation," "Reproducibility Envelope," "Lens Change Proposal," "Adaptation Policy," "Domain Scope." If you need a term the glossary lacks, propose the glossary entry in the same PR.
- **Decisions.** Settled decisions are cited, not re-argued: reference them as ADR-NNNN with a relative link to the file in [`adr/`](adr/). If you believe an ADR is wrong, that is a constitutional proposal, not a footnote.
- **Structure.** Write in paragraphs; use lists and tables only where structure demands them. Cross-reference other repository documents with correct relative links from your file's location.

## JSON examples must validate

The three schemas in [`schemas/`](schemas/) are normative for object structure. Every JSON example in prose or in [`examples/`](examples/) must validate against the relevant schema before a PR is submitted. With Node.js 18+, run `npm install` once, then from the repository root:

```sh
npm run validate
```

That validates every example file in [`examples/`](examples/) and [`poc/lenses/`](poc/lenses/) — files you add under `examples/manifests/` or `examples/diffs/` are picked up automatically. To check a JSON example that lives inline in prose, validate it ad hoc:

```sh
node -e "
const Ajv=require('ajv/dist/2020').default||require('ajv/dist/2020');
const addFormats=require('ajv-formats');
const fs=require('fs');
const ajv=new Ajv({strict:false}); addFormats(ajv);
const validate=ajv.compile(JSON.parse(fs.readFileSync('schemas/lens-manifest.schema.json','utf8')));
const ok=validate(JSON.parse(fs.readFileSync('examples/manifests/avery-daily.json','utf8')));
console.log(ok?'VALID':JSON.stringify(validate.errors,null,2));
"
```

Substitute the schema and example paths for your case. A PR whose examples do not validate will be returned. When prose and a schema disagree, fix whichever is wrong — but say explicitly in the PR which one you judged wrong and why.

Examples should stay realistic and consistent with the repository's running persona: a technologist named Avery and the lens `avery-daily`.

## Licensing of contributions

Contributions are accepted under **inbound = outbound** terms ([ADR-0009](adr/0009-licensing-and-governance.md)): by submitting a contribution, you agree it is licensed under the same license as the material it modifies — [CC-BY 4.0](LICENSE-SPEC) for specification and documentation, [Apache-2.0](LICENSE-CODE) for code, schemas, and the proof of concept (see [LICENSE.md](LICENSE.md)). There is **no CLA**; you retain your copyright. Only submit work you have the right to license this way.

## Conduct

This project follows the [Contributor Covenant 2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/), adopted by reference in [GOVERNANCE.md](GOVERNANCE.md).
