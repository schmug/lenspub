// SPDX-License-Identifier: Apache-2.0
//
// Engine host — LensPub reference engine (PoC).
//
// The MV3 service worker hosts the Lens Engine core: it owns the active Lens
// Manifest, compiles it once per manifest change (compiled rule sets are
// engine-internal, ADR-0001), answers interpret requests from the content
// script with an InterpretationResult, and keeps a per-tab result summary in
// session storage for the popup.
//
// Privacy posture (ADR-0005): everything here runs locally. The only fetch()
// in this file loads the bundled sample lens from the extension's own package
// via chrome.runtime.getURL — a chrome-extension:// resource, never a remote
// host. There is no network I/O anywhere in this extension.

import { compileManifest, validateManifestShape } from '../engine/compile.js';
import { interpret } from '../engine/interpret.js';
import { buildEnvelope } from '../engine/envelope.js';

const ACTIVE_MANIFEST_KEY = 'activeManifest';
const RESULT_KEY_PREFIX = 'result:';

// Compilation cache. The service worker may be stopped and restarted by the
// browser at any time; the cache is rebuilt lazily on the next request.
let compiled = null; // { rules, manifest, source }

/**
 * Load the active Lens Manifest: a user-imported manifest from
 * chrome.storage.local if present, else the bundled sample lens.
 */
async function getActiveManifest() {
  const stored = await chrome.storage.local.get(ACTIVE_MANIFEST_KEY);
  if (stored && stored[ACTIVE_MANIFEST_KEY]) {
    return { manifest: stored[ACTIVE_MANIFEST_KEY], source: 'imported' };
  }
  // Local extension resource (chrome-extension://...), not a remote host.
  const res = await fetch(chrome.runtime.getURL('lenses/avery-daily.json'));
  return { manifest: await res.json(), source: 'bundled' };
}

async function getCompiled() {
  if (compiled) return compiled;
  const { manifest, source } = await getActiveManifest();
  compiled = { rules: compileManifest(manifest), manifest, source };
  return compiled;
}

function invalidateCompiled() {
  compiled = null;
}

function countKinds(annotations) {
  const counts = {};
  for (const a of annotations) counts[a.kind] = (counts[a.kind] || 0) + 1;
  return counts;
}

function lensSummary(manifest, source) {
  return {
    name: manifest.metadata.name,
    lensVersion: manifest.metadata.lensVersion,
    defaultPolicy: manifest.adaptation.defaultPolicy,
    source
  };
}

async function handleMessage(msg, sender) {
  switch (msg && msg.type) {
    case 'lenspub:interpret': {
      const { rules, manifest, source } = await getCompiled();
      const result = interpret(msg.payload || {}, rules, { envelope: buildEnvelope() });
      const tabId = sender && sender.tab && sender.tab.id;
      if (typeof tabId === 'number') {
        await chrome.storage.session.set({
          [RESULT_KEY_PREFIX + tabId]: {
            url: result.target.source,
            title: result.target.title || null,
            counts: countKinds(result.annotations),
            total: result.annotations.length,
            envelope: result.envelope
          }
        });
      }
      return { ok: true, result, lens: lensSummary(manifest, source) };
    }

    case 'lenspub:getPopupState': {
      const { manifest, source } = await getActiveManifest();
      let lastResult = null;
      if (typeof msg.tabId === 'number') {
        const stored = await chrome.storage.session.get(RESULT_KEY_PREFIX + msg.tabId);
        lastResult = stored[RESULT_KEY_PREFIX + msg.tabId] || null;
      }
      return { ok: true, manifest, lens: lensSummary(manifest, source), lastResult };
    }

    case 'lenspub:setManifest': {
      // PoC-level structural validation (see compile.js); the popup validates
      // before sending, this re-checks at the trust boundary of the engine host.
      const check = validateManifestShape(msg.manifest);
      if (!check.ok) return { ok: false, errors: check.errors };
      try {
        compileManifest(msg.manifest); // must also be compilable
      } catch (err) {
        return { ok: false, errors: [String((err && err.message) || err)] };
      }
      await chrome.storage.local.set({ [ACTIVE_MANIFEST_KEY]: msg.manifest });
      invalidateCompiled();
      return { ok: true };
    }

    case 'lenspub:resetManifest': {
      await chrome.storage.local.remove(ACTIVE_MANIFEST_KEY);
      invalidateCompiled();
      return { ok: true };
    }

    default:
      return { ok: false, error: 'unknown message type' };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg, sender)
    .then(sendResponse)
    .catch((err) => {
      try {
        sendResponse({ ok: false, error: String((err && err.message) || err) });
      } catch {
        /* channel already closed */
      }
    });
  return true; // keep the message channel open for the async response
});

// Drop stored per-tab results when tabs close.
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(RESULT_KEY_PREFIX + tabId).catch(() => {});
});
