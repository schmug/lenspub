// SPDX-License-Identifier: Apache-2.0
//
// Conformance adapter for the LensPub reference engine (PoC).
//
// This file is the reference implementation's side of the seam described in
// conformance/ADAPTER.md. It deliberately lives here rather than under
// conformance/: the suite tests the protocol and imports nothing from this
// engine, so every implementation — this one included — supplies its own
// adapter. Yours will look like this file and will not require forking the
// suite.
//
//   npm run conformance                 # runs the suite against this adapter
//
// The PoC is a rule-based engine that implements the Manifest Consumer and
// Lens Engine conformance classes only (architecture/reference-implementation.md
// Section 2). It has no differ and no adaptation machinery, so those roles are
// absent from `roles` below and the suite reports their vectors as SKIPPED —
// which is the honest answer, and not the same answer as passing.

import { compileManifest, validateManifestShape } from './engine/compile.js';
import { interpret as interpretContent } from './engine/interpret.js';
import { locateQuote } from './engine/anchor.js';

export default {
  name: 'lenspub-poc',
  version: '0.1.0',
  capabilityTier: 'rule-based',
  roles: ['manifest-consumer', 'anchor-resolver', 'lens-engine'],

  validateManifest(document) {
    const { ok, errors } = validateManifestShape(document);
    return { accepted: ok, errors };
  },

  resolveAnchor({ content, selector }) {
    return locateQuote(content, selector);
  },

  interpret({ manifest, content }) {
    const rules = compileManifest(manifest);
    return interpretContent(
      {
        url: content.source,
        title: content.title,
        textBlocks: content.blocks.map((b, i) => ({
          text: b.text,
          blockIndex: i,
          tag: b.tag || 'p',
          linkCount: b.linkCount || 0
        }))
      },
      rules
    );
  }
};
