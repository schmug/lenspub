// SPDX-License-Identifier: Apache-2.0
//
// Popup — LensPub reference engine (PoC).
//
// Shows the active Lens Manifest (name, lensVersion, adaptation
// defaultPolicy), per-tab annotation counts by kind, and the execution
// location badge from the Reproducibility Envelope. Provides read-only
// manifest inspection, import (with PoC-level structural validation — see
// validateManifestShape in ../engine/compile.js; full JSON Schema validation
// is exercised by the Node test suite), export as a JSON download, and a
// shortcut to the bundled demo page. All DOM updates use textContent; no
// innerHTML anywhere.

import { validateManifestShape } from '../engine/compile.js';

const $ = (id) => document.getElementById(id);
const statusEl = $('status');

function setStatus(text, kind) {
  statusEl.textContent = text || '';
  statusEl.className = 'status' + (kind ? ' ' + kind : '');
}

let activeManifest = null;

async function refresh() {
  let tabId = null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && typeof tab.id === 'number') tabId = tab.id;
  } catch {
    /* tab lookup can fail in detached windows; state renders without counts */
  }

  const state = await chrome.runtime.sendMessage({ type: 'lenspub:getPopupState', tabId });
  if (!state || !state.ok) {
    setStatus('Engine host unavailable: ' + ((state && state.error) || 'no response'), 'error');
    return;
  }

  activeManifest = state.manifest;
  $('lens-name').textContent = state.lens.name;
  $('lens-version').textContent = state.lens.lensVersion;
  $('lens-policy').textContent = state.lens.defaultPolicy;
  $('lens-source').textContent =
    state.lens.source === 'bundled' ? 'bundled (lenses/avery-daily.json)' : 'imported';
  $('manifest-view').value = JSON.stringify(state.manifest, null, 2);

  const counts = $('counts');
  while (counts.firstChild) counts.removeChild(counts.firstChild);
  if (state.lastResult) {
    $('no-result').hidden = true;
    counts.hidden = false;
    const entries = Object.entries(state.lastResult.counts);
    entries.push(['total', state.lastResult.total]);
    for (const [kind, n] of entries) {
      const dt = document.createElement('dt');
      dt.textContent = kind;
      const dd = document.createElement('dd');
      dd.textContent = String(n);
      counts.appendChild(dt);
      counts.appendChild(dd);
    }
    if (state.lastResult.envelope && state.lastResult.envelope.execution) {
      $('location-badge').textContent = state.lastResult.envelope.execution.location;
    }
  } else {
    $('no-result').hidden = false;
    counts.hidden = true;
  }
}

$('import-file').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = ''; // allow re-selecting the same file
  if (!file) return;
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch (err) {
    setStatus('Import rejected: not valid JSON. ' + String((err && err.message) || err), 'error');
    return;
  }
  const check = validateManifestShape(parsed);
  if (!check.ok) {
    setStatus('Import rejected — not a Lens Manifest:\n' + check.errors.join('\n'), 'error');
    return;
  }
  const resp = await chrome.runtime.sendMessage({ type: 'lenspub:setManifest', manifest: parsed });
  if (!resp || !resp.ok) {
    setStatus('Import rejected by engine host:\n' + ((resp && resp.errors) || [resp && resp.error]).join('\n'), 'error');
    return;
  }
  setStatus(`Imported "${parsed.metadata.name}" v${parsed.metadata.lensVersion}. Reload tabs to reinterpret.`, 'ok');
  await refresh();
});

$('export-btn').addEventListener('click', () => {
  if (!activeManifest) return;
  const blob = new Blob([JSON.stringify(activeManifest, null, 2)], {
    type: 'application/json' // media type application/lens-manifest+json is provisional
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const name = (activeManifest.metadata && activeManifest.metadata.name) || 'lens';
  a.download = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '.lens.json';
  a.click();
  URL.revokeObjectURL(url);
  setStatus('Manifest exported.', 'ok');
});

$('reset-btn').addEventListener('click', async () => {
  const resp = await chrome.runtime.sendMessage({ type: 'lenspub:resetManifest' });
  if (resp && resp.ok) {
    setStatus('Active lens reset to the bundled sample. Reload tabs to reinterpret.', 'ok');
    await refresh();
  }
});

$('demo-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('demo/demo.html') });
});

refresh().catch((err) => setStatus('Popup failed to load state: ' + err, 'error'));
