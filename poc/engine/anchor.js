// SPDX-License-Identifier: Apache-2.0
//
// Anchor Manager — LensPub reference engine (PoC).
//
// Overlay Annotations anchor to content with W3C Selectors, per the LensPub
// profile of the W3C Web Annotation Data Model (ADR-0002,
// ../../adr/0002-profile-web-annotation.md; https://www.w3.org/TR/annotation-model/#selectors).
// This module produces TextQuoteSelectors and implements the robust-anchoring
// fallback required by the Lens Engine specification
// (../../spec/lens-engine.md): exact match -> 'exact'; whitespace-normalized
// match -> 'degraded'; no match -> 'unanchored'. Degraded and unanchored
// outcomes are reported, never hidden — the engine MUST NOT guess-anchor
// silently.
//
// The selector production and string-locating functions are pure so they can
// be unit-tested in Node without a DOM. findQuote() is the DOM-side locator
// used by the content script; it is only ever *called* in a browser.

/** Maximum length of TextQuoteSelector prefix/suffix context, in characters. */
export const CONTEXT_LENGTH = 32;

/**
 * Build a W3C TextQuoteSelector for the span [start, end) of `text`,
 * with up to CONTEXT_LENGTH characters of prefix and suffix context.
 *
 * @param {string} text - the block text the quote was found in.
 * @param {number} start - inclusive start offset of the quote.
 * @param {number} end - exclusive end offset of the quote.
 * @returns {{type: 'TextQuoteSelector', exact: string, prefix: string, suffix: string}}
 */
export function buildTextQuoteSelector(text, start, end) {
  return {
    type: 'TextQuoteSelector',
    exact: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - CONTEXT_LENGTH), start),
    suffix: text.slice(end, end + CONTEXT_LENGTH)
  };
}

/** Collapse all whitespace runs to single spaces and trim. */
export function normalizeWhitespace(s) {
  return String(s).replace(/\s+/g, ' ').trim();
}

/**
 * Normalize whitespace while keeping a map from each normalized character
 * back to its offset in the original string.
 */
function normalizeWithMap(s) {
  let out = '';
  const map = [];
  let lastWasSpace = true; // suppress leading whitespace
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      if (lastWasSpace) continue;
      out += ' ';
      map.push(i);
      lastWasSpace = true;
    } else {
      out += ch;
      map.push(i);
      lastWasSpace = false;
    }
  }
  if (out.endsWith(' ')) {
    out = out.slice(0, -1);
    map.pop();
  }
  return { text: out, map };
}

/**
 * Locate a TextQuoteSelector inside a plain string. Pure; used both by
 * findQuote() below and directly by the Node test suite.
 *
 * Fallback ladder (ADR-0002):
 *   1. exact match of prefix+exact+suffix, else of exact alone -> 'exact'
 *   2. whitespace-normalized match of exact                    -> 'degraded'
 *   3. no match                                                -> 'unanchored'
 *
 * @param {string} haystack - the text to search.
 * @param {object} selector - a TextQuoteSelector.
 * @returns {{status: 'exact'|'degraded'|'unanchored', start: number, end: number}}
 *   start/end are offsets into `haystack` (both -1 when unanchored).
 */
export function locateQuote(haystack, selector) {
  const miss = { status: 'unanchored', start: -1, end: -1 };
  if (typeof haystack !== 'string') return miss;
  if (!selector || selector.type !== 'TextQuoteSelector') return miss;
  const exact = selector.exact;
  if (typeof exact !== 'string' || exact.length === 0) return miss;
  const prefix = typeof selector.prefix === 'string' ? selector.prefix : '';
  const suffix = typeof selector.suffix === 'string' ? selector.suffix : '';

  // 1. Exact, disambiguated by context first.
  if (prefix || suffix) {
    const idx = haystack.indexOf(prefix + exact + suffix);
    if (idx !== -1) {
      return { status: 'exact', start: idx + prefix.length, end: idx + prefix.length + exact.length };
    }
  }
  const idx = haystack.indexOf(exact);
  if (idx !== -1) {
    return { status: 'exact', start: idx, end: idx + exact.length };
  }

  // 2. Degraded: whitespace-normalized match, mapped back to original offsets.
  const normalized = normalizeWithMap(haystack);
  const needle = normalizeWhitespace(exact);
  if (needle.length > 0) {
    const nIdx = normalized.text.indexOf(needle);
    if (nIdx !== -1) {
      const start = normalized.map[nIdx];
      const lastChar = normalized.map[nIdx + needle.length - 1];
      return { status: 'degraded', start, end: lastChar + 1 };
    }
  }

  // 3. Unanchored.
  return miss;
}

// numeric value of NodeFilter.SHOW_TEXT, avoided as a bare global so this
// module still imports cleanly in Node (no DOM globals at module scope).
const SHOW_TEXT = 0x4;

const SKIPPED_PARENTS = /^(?:SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/i;

/**
 * DOM-side locator: find a TextQuoteSelector within `root` and return a Range
 * plus the anchoring status from the fallback ladder above.
 *
 * Browser-only (requires a live DOM); everything above this function is pure.
 *
 * @param {Node} root - element (or Document) to search within.
 * @param {object} selector - a TextQuoteSelector.
 * @returns {{range: Range|null, status: 'exact'|'degraded'|'unanchored'}}
 */
export function findQuote(root, selector) {
  const doc = root.nodeType === 9 ? root : root.ownerDocument;
  const scope = root.nodeType === 9 ? root.body : root;
  if (!doc || !scope) return { range: null, status: 'unanchored' };

  // Build the concatenated text of the scope, remembering node boundaries.
  const nodes = [];
  const starts = [];
  let text = '';
  const walker = doc.createTreeWalker(scope, SHOW_TEXT, null);
  let node;
  while ((node = walker.nextNode())) {
    const parent = node.parentNode;
    if (parent && SKIPPED_PARENTS.test(parent.nodeName)) continue;
    nodes.push(node);
    starts.push(text.length);
    text += node.nodeValue;
  }

  const loc = locateQuote(text, selector);
  if (loc.status === 'unanchored') return { range: null, status: 'unanchored' };

  const range = doc.createRange();
  const [startNode, startOffset] = nodeAtOffset(nodes, starts, loc.start, false);
  const [endNode, endOffset] = nodeAtOffset(nodes, starts, loc.end, true);
  if (!startNode || !endNode) return { range: null, status: 'unanchored' };
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return { range, status: loc.status };
}

/** Map a concatenated-text offset back to (textNode, offsetWithinNode). */
function nodeAtOffset(nodes, starts, offset, isEnd) {
  // For an exclusive end offset, locate the node containing offset-1.
  const target = isEnd ? offset - 1 : offset;
  let i = -1;
  for (let k = 0; k < nodes.length; k++) {
    if (starts[k] <= target) i = k;
    else break;
  }
  if (i === -1) return [null, 0];
  const within = target - starts[i];
  return [nodes[i], isEnd ? within + 1 : within];
}
