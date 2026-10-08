// SPDX-License-Identifier: Apache-2.0
import { compileManifest, validateManifestShape } from '../engine/compile.js';
import { interpret } from '../engine/interpret.js';
import { findQuote } from '../engine/anchor.js';
import { articleHTML, baseManifest } from './bundled.js';

const $ = (id) => document.getElementById(id);
const clone = (value) => JSON.parse(JSON.stringify(value));
let active = clone(baseManifest), draft = clone(active), pending = null;
let history = [], result, fileEpoch = 0, visible = true;
const highlightSupport = !!(globalThis.CSS?.highlights && globalThis.Highlight);
const say = (text) => { $('status').textContent = text; };
const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
function invalidate() {
  fileEpoch++;
  pending = null;
  $('review').hidden = true;
}
function context() {
  return {
    // Synthetic identity: no trusted-origin claims about pasted/bundled articles.
    url: 'about:blank', title: $('article').querySelector('h2')?.textContent || 'Reading',
    textBlocks: [...$('article').querySelectorAll('p:not(.byline),blockquote')].map((p) => ({
      tag: p.tagName.toLowerCase(), text: p.textContent, linkCount: p.querySelectorAll('a').length
    }))
  };
}
function evaluate(manifest) { return interpret(context(), compileManifest(manifest)); }
function settings(preset = 'custom') {
  $('preset').value = preset;
  $('weights').replaceChildren();
  (draft.interpretation.priorities || []).forEach((priority, index) => {
    const label = el('label'); label.htmlFor = `weight-${index}`;
    const row = el('span', undefined, 'weight-label');
    const output = el('output', priority.weight.toFixed(1)); output.htmlFor = `weight-${index}`;
    row.append(el('span', priority.topic), output); label.append(row);
    const input = el('input'); Object.assign(input, {type:'range', min:'-1', max:'1', step:'0.1', value:priority.weight, id:`weight-${index}`});
    input.addEventListener('input', () => {
      invalidate(); priority.weight = Number(input.value); output.textContent = priority.weight.toFixed(1);
      say('Draft changed. Preview to review; your applied lens is unchanged.');
    });
    $('weights').append(label, input);
  });
  $('summary').value = draft.interpretation.presentation?.summaries || 'brief';
  $('evidence').checked = draft.interpretation.presentation?.evidenceIndicators !== false;
}
function setVisible(value) {
  visible = value;
  document.body.classList.toggle('overlays-hidden', !visible);
  $('toggle').textContent = visible ? 'Hide overlays' : 'Show overlays';
  $('toggle').setAttribute('aria-pressed', String(visible));
  render();
}
function clearHighlights() {
  if (highlightSupport) for (const name of ['priorities','evidence','selected']) CSS.highlights.delete(name);
}
function explain(annotation) {
  $('why-title').textContent = annotation.body.value;
  const body = $('why-body'); body.replaceChildren();
  body.append(el('h3','Reasoning trace'), el('p',annotation.reasoning));
  if (annotation.basis) {
    body.append(el('h3','Checkable basis'));
    annotation.basis.forEach((basis) => body.append(el('p',basis.description)));
  }
  body.append(el('h3','Manifest fields'),el('pre',(annotation.manifestRefs || []).join('\n') || 'Schema default'));
  body.append(el('p',`Anchor: ${annotation.anchor.status}. Model: none. Execution: local.`));
  body.append(el('h3','Reproducibility Envelope'),el('pre',JSON.stringify(result.envelope,null,2)));
  $('why').showModal();
}
function render() {
  clearHighlights();
  result = evaluate(active);
  $('active-name').textContent = `${active.metadata.name} · v${active.metadata.lensVersion} · Applied`;
  $('count').textContent = `${result.annotations.length} annotations`;
  $('undo').disabled = history.length === 0;
  $('annotations').replaceChildren();
  const highlights = { priorities: [], evidence: [] };
  for (const annotation of result.annotations) {
    const card = el('div', undefined, `annotation ${annotation.kind}`);
    card.append(el('span', annotation.kind === 'summary' ? 'Extractive summary' : annotation.kind.replaceAll('-',' '), 'kind'));
    const quote = annotation.anchor.selectors.find((s) => s.type === 'TextQuoteSelector');
    if (quote) {
      const located = findQuote($('article'),quote);
      annotation.anchor.status = located.status;
      if (located.range) highlights[annotation.kind === 'highlight' ? 'priorities' : 'evidence'].push(located.range);
      card.append(el('blockquote',`“${quote.exact}”`));
    }
    card.append(el('p',annotation.body.value));
    const why = el('button','Why?');
    why.setAttribute('aria-label', `Why: ${annotation.body.value}`);
    why.addEventListener('click', () => explain(annotation));
    card.append(why); $('annotations').append(card);
  }
  if (!result.annotations.length) $('annotations').append(el('p','No rules matched this text. The original remains available in full.','empty'));
  if (visible && highlightSupport) for (const [name,ranges] of Object.entries(highlights)) CSS.highlights.set(name,new Highlight(...ranges));
}
function preview(candidate = draft) {
  const checked = validateManifestShape(candidate);
  if (!checked.ok) throw new Error(checked.errors.slice(0,3).join(' '));
  const next = evaluate(candidate);
  pending = clone(candidate);
  const oldCount = result.annotations.filter((a) => a.kind === 'highlight').length;
  const newCount = next.annotations.filter((a) => a.kind === 'highlight').length;
  $('comparison').textContent = `${active.metadata.name} → ${candidate.metadata.name}. Priority highlights: ${oldCount} → ${newCount}. Total annotations: ${result.annotations.length} → ${next.annotations.length}. Summary: ${candidate.interpretation.presentation?.summaries || 'brief'}. Article unchanged.`;
  const details = $('preview-details'); details.replaceChildren();
  const before = active.interpretation.priorities || [];
  const after = candidate.interpretation.priorities || [];
  for (const topic of new Set([...before,...after].map((p) => p.topic))) {
    const from = before.find((p) => p.topic === topic)?.weight ?? 'absent';
    const to = after.find((p) => p.topic === topic)?.weight ?? 'absent';
    if (from !== to) details.append(el('p', `${topic}: ${from} → ${to}`));
  }
  const outputs = el('details'); outputs.append(el('summary','Preview resulting annotations'));
  next.annotations.forEach((a) => outputs.append(el('p',`${a.kind}: ${a.body.value}`)));
  if (!next.annotations.length) outputs.append(el('p','No annotations would be shown.'));
  details.append(outputs);
  $('review').hidden = false;
  say('Preview ready. Apply to change the lens, or cancel to keep reading.');
}
$('preset').addEventListener('change', () => {
  invalidate(); draft = clone(baseManifest);
  if ($('preset').value === 'privacy') {
    draft.metadata.name = 'Privacy & local tools';
    draft.interpretation.priorities = draft.interpretation.priorities.filter((p) => ['data privacy','local-first software'].includes(p.topic));
    draft.interpretation.sources.requireProvenance = [];
  } else if ($('preset').value === 'evidence') {
    draft.metadata.name = 'Citation signals'; draft.interpretation.priorities = [];
    draft.interpretation.presentation.summaries = 'none';
  }
  settings($('preset').value); say('Starting lens selected as a draft. Preview before applying.');
});
for (const id of ['summary','evidence']) $(id).addEventListener('change', () => {
  invalidate(); draft.interpretation.presentation ||= {};
  draft.interpretation.presentation.summaries = $('summary').value;
  draft.interpretation.presentation.evidenceIndicators = $('evidence').checked;
  say('Draft changed. Preview before applying.');
});
$('preview').addEventListener('click', () => {
  invalidate();
  // Manual edits form a new local version; no timestamps or reading data added.
  const candidate = clone(draft);
  if (JSON.stringify(candidate) !== JSON.stringify(active)) {
    delete candidate.id; // Local edits do not claim the publisher's identity.
    candidate.metadata.lensVersion = `${active.metadata.lensVersion.split('.')[0]}.${active.metadata.lensVersion.split('.')[1]}.${BigInt(active.metadata.lensVersion.split('.')[2]) + 1n}`;
    delete candidate.metadata.publisher;
    delete candidate.metadata.modified;
    delete candidate.versionHistory;
    delete candidate.proof; // A modified manifest cannot retain a signature.
  }
  try { preview(candidate); } catch (error) { say(error.message); }
});
$('apply').addEventListener('click', () => {
  if (!pending) return;
  history.push(clone(active)); if (history.length > 20) history.shift();
  active = clone(pending); draft = clone(active); invalidate(); settings(); render();
  say('Lens applied. Your source text is unchanged. Undo restores the previous lens.');
});
$('cancel').addEventListener('click', () => {
  invalidate(); draft = clone(active); settings(); say('Preview canceled. Applied lens unchanged.'); $('preview').focus();
});
$('undo').addEventListener('click', () => {
  if (!history.length) return;
  invalidate(); active = history.pop(); draft = clone(active); settings(); render(); say('Previous lens restored.');
});
$('toggle').addEventListener('click', () => { setVisible(!visible); say(visible ? 'Overlays visible.' : 'Original view. All overlays hidden.'); });
$('export').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(active,null,2)+'\n'],{type:'application/json'}));
  const a = el('a'); a.href = url; a.download = 'lenspub-manifest.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
  say('Applied Lens Manifest exported. No article or interpretation result was added.');
});
$('import').addEventListener('click', () => { invalidate(); $('file').value = ''; $('file').click(); });
$('file').addEventListener('change', async () => {
  const file = $('file').files[0]; const epoch = ++fileEpoch;
  if (!file) return;
  try {
    if (file.size > 100000) throw new Error('Manifest is too large (limit: 100 KB).');
    const text = await file.text();
    if (epoch !== fileEpoch) return;
    const candidate = JSON.parse(text);
    const check = validateManifestShape(candidate);
    if (!check.ok) throw new Error(check.errors.slice(0,3).join(' '));
    preview(candidate); draft = clone(candidate); settings();
    say('Imported lens validated and staged. Review then Apply. No subscriptions, remote inference, or signature verification will run.');
  } catch (error) {
    if (epoch === fileEpoch) say(`Import refused. Applied lens unchanged. ${error.message}`);
  }
});
$('content').addEventListener('click', () => {
  invalidate(); $('text-error').textContent = ''; $('text-dialog').showModal();
});
$('text-cancel').addEventListener('click', () => $('text-dialog').close());
$('text-form').addEventListener('submit', (event) => {
  event.preventDefault(); const text = $('text-input').value;
  if (!text.trim() || text.length > 50000) { $('text-error').textContent = 'Enter 1–50,000 characters of nonblank text.'; return; }
  invalidate(); clearHighlights();
  const article = $('article'); article.replaceChildren(el('h2',$('text-title').value.trim() || 'My reading'));
  // Untrusted input is text only. No parsing, HTML injection, links, or fetches.
  text.split(/\n\s*\n/).forEach((paragraph) => article.append(el('p',paragraph)));
  $('source-label').textContent = 'YOUR PASTED TEXT · THIS TAB ONLY';
  $('text-dialog').close(); render(); say('Your text is ready. Local rules only; nothing was uploaded.'); article.focus();
});
$('reset').addEventListener('click', () => { invalidate(); $('reset-dialog').showModal(); });
$('reset-cancel').addEventListener('click', () => $('reset-dialog').close());
$('reset-confirm').addEventListener('click', () => {
  invalidate(); history = []; active = clone(baseManifest); draft = clone(active);
  $('article').innerHTML = articleHTML; // Static, checked-in fixture only.
  $('source-label').textContent = 'BUNDLED FICTIONAL ARTICLE';
  $('preset').value = 'daily'; $('text-input').value = ''; $('text-title').value = 'My reading';
  settings('daily'); setVisible(true); $('reset-dialog').close(); say('Demo reset. Bundled article and lens restored.');
});
$('article').innerHTML = articleHTML; // Never used with user input.
settings('daily'); render();
say(highlightSupport ? 'Your lens is on. Try “Why?” to inspect a rule, or adjust a priority and preview the change.' : 'Your lens is on. This browser shows annotations in the side panel; inline highlights need CSS Highlight API support.');
