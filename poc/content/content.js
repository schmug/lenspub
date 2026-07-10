// SPDX-License-Identifier: Apache-2.0
//
// Content script — LensPub reference engine (PoC).
//
// Extracts text blocks from the rendered DOM (interpretation is a
// user-agent-side, post-render overlay stage — ADR-0008), asks the engine
// host (background service worker) for an InterpretationResult, and renders
// Overlay Annotations:
//
//  * highlights, by wrapping the matched text range (the original text nodes
//    are never modified or removed — wrap only, unwrapped cleanly on dismiss);
//  * a margin badge per annotation, with a click-to-open explanation card
//    showing body, kind, Reasoning Trace, basis, anchor status, and the
//    Reproducibility Envelope;
//  * a floating lens indicator (bottom corner) with lens name, version, and a
//    local/remote badge, which toggles all overlays.
//
// All overlay UI lives in a Shadow DOM to isolate styles. Annotation text is
// engine-generated but is still always inserted via textContent, never
// innerHTML. The whole script is defensive: it must not throw on weird pages
// (failures are reported with console.debug and the page is left untouched).
//
// This file also runs as a plain page script on the bundled demo page
// (poc/demo/demo.html opened at its chrome-extension:// URL), where content
// scripts cannot be injected; the guards below make both paths safe.

(() => {
  'use strict';

  const TAG = 'LensPub PoC:';
  const MAX_BLOCKS = 200;
  const ACTIVE_ATTR = 'data-lenspub-active';

  try {
    // Not an extension context: e.g. this file loaded as a plain <script> from
    // disk (demo.html opened over file:// without the extension). Do nothing.
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) return;
    if (!document || !document.documentElement || !document.body) return;
    // Another copy of this script already runs in a different world (content
    // script vs. demo page script). The DOM attribute is shared across worlds.
    if (document.documentElement.hasAttribute(ACTIVE_ATTR)) return;
    document.documentElement.setAttribute(ACTIVE_ATTR, '');
    main().catch((err) => console.debug(TAG, 'interpretation skipped:', err));
  } catch (err) {
    console.debug(TAG, 'init failed:', err);
  }

  async function main() {
    // Anchor Manager (engine module, shared with the Node tests) loaded as an
    // ES module; MV3 content scripts cannot be static modules, so we use a
    // dynamic import of an extension-local resource.
    const anchor = await import(chrome.runtime.getURL('engine/anchor.js'));

    // --- 1. Extract text blocks from the rendered DOM ----------------------
    const blocks = [];
    const candidates = document.body.querySelectorAll('p, li, h1, h2, h3, blockquote');
    for (const el of candidates) {
      if (blocks.length >= MAX_BLOCKS) break;
      try {
        if (el.closest('nav, aside, header, footer, [data-lenspub-ui]')) continue;
        // Count a blockquote once, as a whole.
        if (!el.matches('blockquote') && el.closest('blockquote')) continue;
        const text = (el.innerText || el.textContent || '').trim();
        if (text.length < 8) continue;
        blocks.push({
          text,
          blockIndex: blocks.length,
          tag: el.tagName.toLowerCase(),
          linkCount: el.querySelectorAll('a[href]').length
        });
      } catch (err) {
        console.debug(TAG, 'skipping block:', err);
      }
    }
    if (blocks.length === 0) return;

    // --- 2. Ask the engine host for an InterpretationResult ----------------
    const resp = await chrome.runtime.sendMessage({
      type: 'lenspub:interpret',
      payload: { url: location.href, title: document.title, textBlocks: blocks }
    });
    if (!resp || !resp.ok) {
      console.debug(TAG, 'engine host declined:', resp && resp.error);
      return;
    }
    const result = resp.result;
    const lens = resp.lens;
    if (!result.annotations.length) return;

    // --- 3. Overlay UI scaffolding (Shadow DOM) -----------------------------
    // overlay.css is injected twice: by the manifest into the page (styling
    // the wrapper spans, which live in the page DOM) and here into the shadow
    // root (styling badges, cards, and the indicator). It is a local
    // extension resource, never a remote host.
    let cssText = '';
    try {
      cssText = await (await fetch(chrome.runtime.getURL('content/overlay.css'))).text();
    } catch (err) {
      console.debug(TAG, 'overlay.css unavailable:', err);
    }
    // On the demo page (extension page), the manifest-declared CSS does not
    // apply, so also mirror the page-level rules into a <style> element.
    if (cssText && !document.getElementById('lenspub-page-style')) {
      try {
        const pageStyle = document.createElement('style');
        pageStyle.id = 'lenspub-page-style';
        pageStyle.textContent = cssText;
        (document.head || document.documentElement).appendChild(pageStyle);
      } catch (err) {
        console.debug(TAG, 'page style injection failed:', err);
      }
    }

    const host = document.createElement('div');
    host.setAttribute('data-lenspub-ui', '');
    host.style.all = 'initial';
    const shadow = host.attachShadow({ mode: 'open' });
    const shadowStyle = document.createElement('style');
    shadowStyle.textContent = cssText;
    shadow.appendChild(shadowStyle);

    const badgeLayer = document.createElement('div');
    badgeLayer.className = 'lp-badge-layer';
    shadow.appendChild(badgeLayer);

    const card = buildCardShell(shadow);
    const indicator = buildIndicator(shadow, lens, result);
    document.documentElement.appendChild(host);

    // --- 4. Anchor and render each Overlay Annotation ----------------------
    const KIND_GLYPHS = {
      highlight: 'H',
      'evidence-indicator': 'E',
      summary: 'S',
      annotation: 'A',
      counterpoint: 'C',
      'primary-source': 'P'
    };
    const state = {
      visible: true,
      badges: [], // { el, refEl }
      spans: [] // wrapper spans in the page DOM
    };

    for (const anno of result.annotations) {
      try {
        if (anno.anchor.status === 'document') {
          addDockBadge(anno, 'document');
          continue;
        }
        const selector = (anno.anchor.selectors || []).find((s) => s.type === 'TextQuoteSelector');
        let placed = false;
        if (selector) {
          const { range, status } = anchor.findQuote(document.body, selector);
          if (range) {
            const spans = wrapRange(range, anno, status);
            if (spans.length > 0) {
              addMarginBadge(spans[0], anno, status);
              placed = true;
            }
          }
        }
        if (!placed) {
          // Robust-anchoring fallback (ADR-0002): never guess-anchor silently.
          // Unanchored annotations are presented in the lens panel, marked.
          addDockBadge(anno, 'unanchored');
        }
      } catch (err) {
        console.debug(TAG, 'annotation render failed:', anno && anno.id, err);
      }
    }

    let repositionTimer = null;
    const reposition = () => {
      if (repositionTimer) return;
      repositionTimer = setTimeout(() => {
        repositionTimer = null;
        for (const b of state.badges) positionBadge(b.el, b.refEl);
      }, 150);
    };
    window.addEventListener('resize', reposition, { passive: true });
    window.addEventListener('load', reposition, { passive: true });
    setTimeout(reposition, 1500); // late layout shifts (images, fonts)

    // ------------------------------------------------------------------ UI --

    function wrapRange(range, anno, status) {
      const spans = [];
      let start = range.startContainer;
      let end = range.endContainer;
      const TEXT = 3; // Node.TEXT_NODE
      if (start.nodeType !== TEXT || end.nodeType !== TEXT) return spans;

      const startOffset = range.startOffset;
      const endOffset = range.endOffset;
      if (start === end) {
        let node = start;
        if (endOffset < node.nodeValue.length) node.splitText(endOffset);
        if (startOffset > 0) node = node.splitText(startOffset);
        spans.push(wrapTextNode(node, anno, status));
        return spans;
      }
      // Split boundaries so whole text nodes fall inside the range, then walk
      // document order from start to end collecting them.
      if (endOffset < end.nodeValue.length) end.splitText(endOffset);
      if (startOffset > 0) start = start.splitText(startOffset);
      const walker = document.createTreeWalker(range.commonAncestorContainer, 0x4 /* SHOW_TEXT */, null);
      walker.currentNode = start;
      let node = start;
      const toWrap = [];
      while (node) {
        toWrap.push(node);
        if (node === end) break;
        node = walker.nextNode();
      }
      for (const n of toWrap) spans.push(wrapTextNode(n, anno, status));
      return spans;
    }

    function wrapTextNode(node, anno, status) {
      // Wrap only: the original text node is moved, never modified or removed,
      // and dismissing the overlay restores it exactly (see unwrapAll).
      const span = document.createElement('span');
      span.setAttribute('data-lenspub-wrap', anno.kind);
      span.setAttribute('data-lenspub-id', anno.id || '');
      if (status === 'degraded') span.setAttribute('data-lenspub-degraded', '');
      span.setAttribute('tabindex', '0');
      span.setAttribute('role', 'button');
      span.setAttribute(
        'aria-label',
        `LensPub ${anno.kind} annotation, anchor ${status}. Activate for explanation.`
      );
      span.addEventListener('click', (e) => {
        e.stopPropagation();
        openCard(anno, status);
      });
      span.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openCard(anno, status);
        }
      });
      node.parentNode.insertBefore(span, node);
      span.appendChild(node);
      state.spans.push(span);
      return span;
    }

    function addMarginBadge(refEl, anno, status) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `lp-badge lp-kind-${anno.kind}` + (status === 'degraded' ? ' lp-degraded' : '');
      btn.textContent = KIND_GLYPHS[anno.kind] || '?';
      btn.setAttribute(
        'aria-label',
        `LensPub ${anno.kind} annotation, anchor ${status}: ${anno.body.value} Activate for explanation.`
      );
      btn.title = `${anno.kind} (anchor: ${status})`;
      btn.addEventListener('click', () => openCard(anno, status));
      positionBadge(btn, refEl);
      badgeLayer.appendChild(btn);
      state.badges.push({ el: btn, refEl });
    }

    function positionBadge(btn, refEl) {
      try {
        const r = refEl.getBoundingClientRect();
        btn.style.top = `${Math.max(0, r.top + window.scrollY - 2)}px`;
        btn.style.left = `${Math.max(2, r.left + window.scrollX - 26)}px`;
      } catch (err) {
        console.debug(TAG, 'badge positioning failed:', err);
      }
    }

    function addDockBadge(anno, status) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `lp-badge lp-dock-badge lp-kind-${anno.kind}` + (status === 'unanchored' ? ' lp-unanchored' : '');
      btn.textContent = KIND_GLYPHS[anno.kind] || '?';
      const scope = status === 'unanchored' ? 'unanchored (shown here, not in place)' : 'whole document';
      btn.setAttribute('aria-label', `LensPub ${anno.kind} annotation, ${scope}: ${anno.body.value} Activate for explanation.`);
      btn.title = `${anno.kind} (${scope})`;
      btn.addEventListener('click', () => openCard(anno, status));
      indicator.dock.appendChild(btn);
    }

    function buildCardShell(root) {
      const el = document.createElement('div');
      el.className = 'lp-card';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-label', 'LensPub annotation explanation');
      el.setAttribute('tabindex', '-1');
      el.hidden = true;
      root.appendChild(el);
      root.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !el.hidden) closeCard();
      });
      return el;
    }

    function closeCard() {
      card.hidden = true;
      while (card.firstChild) card.removeChild(card.firstChild);
    }

    function line(parent, className, label, value) {
      const row = document.createElement('div');
      row.className = className;
      if (label) {
        const dt = document.createElement('span');
        dt.className = 'lp-card-label';
        dt.textContent = label;
        row.appendChild(dt);
      }
      const dd = document.createElement('span');
      dd.textContent = value; // engine-generated, but always treated as text
      row.appendChild(dd);
      parent.appendChild(row);
      return row;
    }

    function openCard(anno, status) {
      closeCard();
      const head = document.createElement('div');
      head.className = 'lp-card-head';
      const kind = document.createElement('span');
      kind.className = `lp-chip lp-kind-${anno.kind}`;
      kind.textContent = anno.kind;
      head.appendChild(kind);
      const anchorChip = document.createElement('span');
      anchorChip.className = 'lp-chip lp-chip-anchor' + (status === 'exact' || status === 'document' ? '' : ' lp-chip-warn');
      anchorChip.textContent = `anchor: ${status}`;
      head.appendChild(anchorChip);
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'lp-card-close';
      close.textContent = '×';
      close.setAttribute('aria-label', 'Close explanation');
      close.addEventListener('click', closeCard);
      head.appendChild(close);
      card.appendChild(head);

      line(card, 'lp-card-body', null, anno.body.value);
      line(card, 'lp-card-section', 'Why (reasoning trace)', anno.reasoning);

      if (Array.isArray(anno.basis) && anno.basis.length > 0) {
        const section = document.createElement('div');
        section.className = 'lp-card-section';
        const label = document.createElement('span');
        label.className = 'lp-card-label';
        label.textContent = 'Basis (checkable facts, not a verdict)';
        section.appendChild(label);
        const list = document.createElement('ul');
        list.className = 'lp-basis-list';
        for (const b of anno.basis) {
          const li = document.createElement('li');
          const t = document.createElement('span');
          t.className = 'lp-basis-type';
          t.textContent = `[${b.type}] `;
          li.appendChild(t);
          if (b.description) li.appendChild(document.createTextNode(b.description + ' '));
          if (b.uri) {
            const a = document.createElement('a');
            a.href = b.uri;
            a.textContent = b.uri;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            li.appendChild(a);
          }
          list.appendChild(li);
        }
        section.appendChild(list);
        card.appendChild(section);
      }

      if (Array.isArray(anno.manifestRefs) && anno.manifestRefs.length > 0) {
        line(card, 'lp-card-section', 'Manifest fields', anno.manifestRefs.join(', '));
      }

      const env = result.envelope;
      line(
        card,
        'lp-card-section lp-card-envelope',
        'Reproducibility Envelope',
        `engine ${env.engine.id} v${env.engine.version} · tier ${env.engine.capabilityTier} · ` +
          `execution ${env.execution.location} · model ${env.model ? env.model.id : 'none (rule-based)'} · ` +
          `generated ${env.generatedAt || 'n/a'}`
      );

      card.hidden = false;
      card.focus();
    }

    function buildIndicator(root, lensInfo, res) {
      const wrap = document.createElement('div');
      wrap.className = 'lp-indicator';
      wrap.setAttribute('role', 'region');
      wrap.setAttribute('aria-label', 'LensPub lens indicator');

      const row = document.createElement('div');
      row.className = 'lp-indicator-row';

      const name = document.createElement('span');
      name.className = 'lp-lens-name';
      name.textContent = `${lensInfo.name} v${lensInfo.lensVersion}`;
      name.title = 'Active Lens Manifest (name and lensVersion)';
      row.appendChild(name);

      const loc = document.createElement('span');
      const location = res.envelope.execution.location;
      loc.className = 'lp-chip lp-chip-local' + (location === 'remote' ? ' lp-chip-warn' : '');
      loc.textContent = location;
      loc.title = 'Where interpretation ran (Reproducibility Envelope, ADR-0005)';
      row.appendChild(loc);

      const count = document.createElement('span');
      count.className = 'lp-chip';
      count.textContent = `${res.annotations.length} annotations`;
      row.appendChild(count);

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'lp-indicator-btn';
      toggle.textContent = 'Hide';
      toggle.setAttribute('aria-pressed', 'false');
      toggle.setAttribute('aria-label', 'Toggle LensPub overlays');
      toggle.addEventListener('click', () => {
        state.visible = !state.visible;
        toggle.textContent = state.visible ? 'Hide' : 'Show';
        toggle.setAttribute('aria-pressed', state.visible ? 'false' : 'true');
        badgeLayer.classList.toggle('lp-hidden', !state.visible);
        dock.classList.toggle('lp-hidden', !state.visible);
        for (const span of state.spans) span.toggleAttribute('data-lenspub-off', !state.visible);
        if (!state.visible) closeCard();
      });
      row.appendChild(toggle);

      const dismiss = document.createElement('button');
      dismiss.type = 'button';
      dismiss.className = 'lp-indicator-btn';
      dismiss.textContent = '×';
      dismiss.setAttribute('aria-label', 'Dismiss LensPub overlays and restore the page');
      dismiss.title = 'Dismiss: unwrap all highlights and remove the overlay';
      dismiss.addEventListener('click', dismissAll);
      row.appendChild(dismiss);

      wrap.appendChild(row);

      const dock = document.createElement('div');
      dock.className = 'lp-dock';
      dock.setAttribute('aria-label', 'Document-level and unanchored annotations');
      wrap.appendChild(dock);

      root.appendChild(wrap);
      return { wrap, dock };
    }

    function unwrapAll() {
      for (const span of state.spans) {
        try {
          const parent = span.parentNode;
          if (!parent) continue;
          while (span.firstChild) parent.insertBefore(span.firstChild, span);
          parent.removeChild(span);
          parent.normalize(); // merge the text nodes we split when wrapping
        } catch (err) {
          console.debug(TAG, 'unwrap failed:', err);
        }
      }
      state.spans.length = 0;
    }

    function dismissAll() {
      try {
        unwrapAll();
        window.removeEventListener('resize', reposition);
        window.removeEventListener('load', reposition);
        host.remove();
        const pageStyle = document.getElementById('lenspub-page-style');
        if (pageStyle) pageStyle.remove();
        document.documentElement.removeAttribute(ACTIVE_ATTR);
      } catch (err) {
        console.debug(TAG, 'dismiss failed:', err);
      }
    }
  }
})();
