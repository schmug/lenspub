// SPDX-License-Identifier: Apache-2.0
//
// Self-test fixture: the engine that says yes to everything.
//
// It declares all five roles and gets every one of them wrong in the specific
// way the specification prohibits — it accepts every manifest, anchors every
// quote exactly wherever it likes, classifies every change as trivial,
// auto-accepts every proposal, sends interpretation to a provider nobody opted
// in, and diffs anything it is handed.
//
// conformance/self-test/run-self-test.mjs requires every adapter-driven
// negative vector to FAIL against it. That is the property that makes the
// negative half of the suite worth anything: a vector that no wrong engine can
// fail is decoration, and a suite of them would certify a permissive engine as
// conforming.

const PERMISSIVE_POLICY = {
  proposalFrequency: 99,
  evidenceThreshold: 1,
  autoAcceptCeiling: 'minor',
  exploratoryProposalsPermitted: true
};

export default {
  name: 'permissive-fixture',
  version: '0.0.0',
  capabilityTier: 'rule-based',
  roles: ['manifest-consumer', 'anchor-resolver', 'lens-engine', 'adaptation-engine', 'differ'],

  validateManifest() {
    return { accepted: true };
  },

  resolveAnchor({ content }) {
    // Guess-anchoring: claims the quote was verifiably located, at the whole
    // document, whatever the selector said.
    return { status: 'exact', start: 0, end: content.length };
  },

  interpret({ manifest }) {
    // Deliberately schema-valid, so the failures the suite reports are the
    // semantic ones rather than a malformed-JSON complaint: an 'exact' anchor
    // on a quote the page does not contain, and a trust-boundary crossing under
    // a scope no manifest opted in.
    return {
      lenspub: '0.1',
      type: 'InterpretationResult',
      target: { source: 'https://example.invalid/whatever' },
      lens: { lensVersion: manifest.metadata.lensVersion },
      envelope: {
        engine: { id: 'permissive-fixture', version: '0.0.0', capabilityTier: 'rule-based' },
        execution: { location: 'remote', optInScope: 'a-scope-nobody-opted-in' }
      },
      annotations: [
        {
          id: 'anno-1',
          kind: 'summary',
          anchor: { selectors: [{ type: 'CssSelector', value: 'body' }], status: 'document' },
          body: { value: 'A summary, produced whether or not the manifest asked for one.' },
          reasoning: 'Because summarising is what this fixture does.'
        },
        {
          id: 'anno-2',
          kind: 'highlight',
          anchor: {
            selectors: [{ type: 'TextQuoteSelector', exact: 'a phrase this page does not contain' }],
            status: 'exact'
          },
          body: { value: 'Highlighted.' },
          reasoning: 'Because highlighting is what this fixture does.'
        }
      ]
    };
  },

  resolvePolicy() {
    return { ...PERMISSIVE_POLICY };
  },

  classifyImpact() {
    return 'trivial';
  },

  disposeProposal() {
    return { disposition: 'auto-accept' };
  },

  diff({ from, to }) {
    return {
      refused: false,
      diff: {
        lenspub: '0.1',
        type: 'LensDiff',
        from: { lensVersion: from.metadata.lensVersion },
        to: { lensVersion: to.metadata.lensVersion },
        changes: []
      }
    };
  }
};
