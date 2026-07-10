// SPDX-License-Identifier: Apache-2.0
//
// Manifest Compiler — LensPub reference engine (PoC), rule-based capability tier.
//
// A Lens Manifest is a declarative, model-agnostic policy document (ADR-0001,
// ../../adr/0001-manifest-is-declarative-policy.md). This module compiles that
// policy into the engine-internal artifacts this rule-based engine needs:
// priority term matchers, source origin matchers, provenance requirements, and
// resolved presentation flags. Compiled rule sets are engine-internal and are
// never an exchange object; only the Lens Manifest itself is portable.
//
// This module is pure and DOM-free so it can be unit-tested in Node
// (see ../test/run-tests.mjs).

/**
 * Presentation defaults, mirroring the `default` values declared in
 * ../../schemas/lens-manifest.schema.json (interpretation.presentation).
 */
export const PRESENTATION_DEFAULTS = Object.freeze({
  annotations: true,
  summaries: 'brief',
  evidenceIndicators: true,
  counterpoints: 'on-request',
  primarySourceExpansion: true,
  explanationDisplay: 'on-request'
});

/**
 * PoC-level structural validation of a Lens Manifest.
 *
 * This is deliberately NOT full JSON Schema validation. It checks only the
 * required top-level structure (lenspub / type / metadata / interpretation /
 * adaptation) so that the popup's import flow can reject obviously wrong
 * files with a readable error. Conforming implementations SHOULD validate
 * against ../../schemas/lens-manifest.schema.json; the Node test suite does
 * exactly that with Ajv.
 *
 * @param {unknown} manifest - parsed JSON value to check.
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateManifestShape(manifest) {
  const errors = [];
  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { ok: false, errors: ['Manifest must be a JSON object.'] };
  }
  if (manifest.lenspub !== '0.1') {
    errors.push("Field 'lenspub' must be the string '0.1'.");
  }
  if (manifest.type !== 'LensManifest') {
    errors.push("Field 'type' must be the string 'LensManifest'.");
  }
  const md = manifest.metadata;
  if (!md || typeof md !== 'object' || Array.isArray(md)) {
    errors.push("Required object field 'metadata' is missing.");
  } else {
    if (typeof md.name !== 'string' || md.name.length === 0) {
      errors.push("'metadata.name' must be a non-empty string.");
    }
    if (typeof md.lensVersion !== 'string' || !/^\d+\.\d+\.\d+$/.test(md.lensVersion)) {
      errors.push("'metadata.lensVersion' must be a semantic version such as '1.0.0'.");
    }
  }
  if (!manifest.interpretation || typeof manifest.interpretation !== 'object' || Array.isArray(manifest.interpretation)) {
    errors.push("Required object field 'interpretation' is missing.");
  }
  const ad = manifest.adaptation;
  if (!ad || typeof ad !== 'object' || Array.isArray(ad)) {
    errors.push("Required object field 'adaptation' is missing.");
  } else if (typeof ad.defaultPolicy !== 'string') {
    errors.push("'adaptation.defaultPolicy' is required (one of: locked, conservative, balanced, adaptive, explorer, custom).");
  }
  return { ok: errors.length === 0, errors };
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a case-insensitive matcher for a priority topic. Tokens separated by
 * whitespace or hyphens in the topic match either separator in content, so
 * the topic "local-first software" also matches "local first software".
 * The pattern is anchored at alphanumeric boundaries to avoid substring hits.
 *
 * @param {string} topic
 * @returns {RegExp} non-global, case-insensitive
 */
export function topicPattern(topic) {
  const tokens = String(topic).trim().split(/[\s-]+/).filter(Boolean).map(escapeRegExp);
  if (tokens.length === 0) return /(?!)/; // never matches
  const body = tokens.join('[\\s-]+');
  return new RegExp(`(?<![A-Za-z0-9])(?:${body})(?![A-Za-z0-9])`, 'i');
}

/**
 * Test whether a page URL matches a manifest source entry's `origin`, which
 * per the schema may be an origin ("https://example.com"), a registrable
 * domain ("example.com"), or a DID.
 *
 * PoC limits: DID origins are never matched (this engine performs no DID
 * resolution; see ../../adr/0003-adopt-vc2-dids-for-trust.md), and scheme/port
 * are ignored when a full origin is given — hostnames are compared. A
 * registrable domain matches itself and any subdomain.
 *
 * @param {string} urlString - the page URL.
 * @param {string} originSpec - the manifest `origin` value.
 * @returns {boolean}
 */
export function matchesOrigin(urlString, originSpec) {
  if (typeof originSpec !== 'string' || originSpec.length === 0) return false;
  if (originSpec.startsWith('did:')) return false; // DID resolution is out of PoC scope
  let host;
  try {
    host = new URL(urlString).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (host === '') return false; // e.g. file: URLs have no host to match
  let domain = originSpec.toLowerCase();
  if (domain.includes('://')) {
    try {
      domain = new URL(domain).hostname.toLowerCase();
    } catch {
      return false;
    }
  }
  return host === domain || host.endsWith('.' + domain);
}

function compileSourceList(list, side) {
  return (Array.isArray(list) ? list : []).map((entry, i) => ({
    origin: entry.origin,
    weight: typeof entry.weight === 'number' ? entry.weight : 1, // schema default
    note: typeof entry.note === 'string' ? entry.note : null,
    manifestRef: `/interpretation/sources/${side}/${i}`
  }));
}

/**
 * Compile a Lens Manifest into the rule set used by interpret.js.
 *
 * @param {object} manifest - a Lens Manifest (see ../../schemas/lens-manifest.schema.json).
 * @returns {object} compiled rule set (engine-internal; not an exchange object).
 * @throws {Error} when the manifest fails PoC structural validation.
 */
export function compileManifest(manifest) {
  const shape = validateManifestShape(manifest);
  if (!shape.ok) {
    throw new Error('Invalid Lens Manifest: ' + shape.errors.join(' '));
  }
  const interp = manifest.interpretation || {};
  const sources = interp.sources || {};

  const priorities = (Array.isArray(interp.priorities) ? interp.priorities : [])
    .filter((p) => p && typeof p.topic === 'string' && typeof p.weight === 'number')
    .map((p, i) => ({
      topic: p.topic,
      weight: p.weight,
      rationale: typeof p.rationale === 'string' ? p.rationale : null,
      domains: Array.isArray(p.domains) ? p.domains.slice() : null,
      pattern: topicPattern(p.topic),
      manifestRef: `/interpretation/priorities/${i}`
    }));

  const requireProvenance = (Array.isArray(sources.requireProvenance) ? sources.requireProvenance : [])
    .map((signal, i) => ({
      signal,
      manifestRef: `/interpretation/sources/requireProvenance/${i}`
    }));

  const explicitPresentation = (interp.presentation && typeof interp.presentation === 'object')
    ? interp.presentation
    : {};
  const presentation = { ...PRESENTATION_DEFAULTS, ...explicitPresentation };
  // Record which presentation fields the manifest set explicitly, so reasoning
  // traces can cite a real manifest path (JSON Pointer) versus a schema default.
  const presentationRefs = {};
  for (const key of Object.keys(PRESENTATION_DEFAULTS)) {
    presentationRefs[key] = Object.prototype.hasOwnProperty.call(explicitPresentation, key)
      ? `/interpretation/presentation/${key}`
      : null;
  }

  return {
    lens: {
      id: typeof manifest.id === 'string' ? manifest.id : null,
      name: manifest.metadata.name,
      lensVersion: manifest.metadata.lensVersion,
      defaultPolicy: manifest.adaptation.defaultPolicy
    },
    priorities,
    trusted: compileSourceList(sources.trusted, 'trusted'),
    distrusted: compileSourceList(sources.distrusted, 'distrusted'),
    requireProvenance,
    presentation,
    presentationRefs
  };
}
