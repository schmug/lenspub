// SPDX-License-Identifier: Apache-2.0
//
// Interpretation Pipeline — LensPub reference engine (PoC), rule-based
// capability tier.
//
// Takes an extracted content context ({url, title, textBlocks}) plus a rule
// set compiled by compile.js and produces an Interpretation Result conforming
// to ../../schemas/interpretation-result.schema.json: Overlay Annotations,
// each with a Reasoning Trace, plus the mandatory Reproducibility Envelope
// (ADR-0004). Interpretation is an overlay stage: this pipeline only ever
// *adds* annotations over content; it never rewrites, filters, or reorders it
// (ADR-0008). Evidence-class annotations carry a `basis` of checkable facts
// and never a truth verdict (ADR-0007).
//
// This module is pure and DOM-free so it can be unit-tested in Node.
// Text block shape: { text: string, blockIndex: number, tag?: string,
// linkCount?: number } — `linkCount` is the number of hyperlinks the block
// contained in the rendered DOM, used by the citations heuristic below.

import { buildTextQuoteSelector } from './anchor.js';
import { buildEnvelope } from './envelope.js';
import { matchesOrigin } from './compile.js';

/** Hard cap on annotations per result, to keep overlays legible. */
export const MAX_ANNOTATIONS = 50;
/** At most this many highlights per priority across a document. */
const MAX_HIGHLIGHTS_PER_PRIORITY = 5;
/** At most this many uncited-claim indicators per document. */
const MAX_CITATION_INDICATORS = 10;

/**
 * Heuristic marker of a quantitative claim: a percentage, or a bare number of
 * two or more digits. Deliberately shallow; every reasoning trace that relies
 * on it says so.
 */
const CLAIM_PATTERN = /(\d+(?:[.,]\d+)?\s*(?:%|percent(?:age)?\b))|(\b\d{2,}(?:[,.]\d+)*\b)/i;

/**
 * Split text into sentences with their offsets. Rough splitting on
 * terminal punctuation; adequate for the rule-based tier.
 * @returns {Array<{text: string, start: number, end: number}>}
 */
export function splitSentences(text) {
  const out = [];
  const re = /[^.!?]+[.!?]+(?:["')\]]+)?|[^.!?]+$/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    const leading = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;
    const start = m.index + leading;
    out.push({ text: trimmed, start, end: start + trimmed.length });
  }
  return out;
}

/** 32-bit FNV-1a hash (hex), for the target.contentHash drift-detection field. */
export function fnv1a32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0;
  }
  return ('0000000' + h.toString(16)).slice(-8);
}

function documentSelector() {
  // The schema requires at least one selector even for document-status
  // annotations; a CssSelector for the root element is the whole document.
  return { type: 'CssSelector', value: 'html' };
}

function pageOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Apply a compiled rule set to extracted page content.
 *
 * @param {{url: string, title?: string, textBlocks: Array<object>}} context
 * @param {object} rules - output of compileManifest().
 * @param {{envelope?: object}} [options] - optional envelope override (tests).
 * @returns {object} an InterpretationResult
 *   (../../schemas/interpretation-result.schema.json).
 */
export function interpret(context, rules, options = {}) {
  const url = typeof context.url === 'string' && context.url ? context.url : 'about:blank';
  const title = typeof context.title === 'string' ? context.title : null;
  const textBlocks = (Array.isArray(context.textBlocks) ? context.textBlocks : [])
    .filter((b) => b && typeof b.text === 'string' && b.text.length > 0);

  const annotations = [];
  let seq = 0;
  const nextId = () => `anno-${++seq}`;

  // --- 1. Document-level extractive summary -------------------------------
  // Rule-based tier: first-sentences extraction, no abstraction or paraphrase.
  if (rules.presentation.summaries !== 'none') {
    const maxSentences = rules.presentation.summaries === 'detailed' ? 4 : 2;
    const picked = [];
    for (const block of textBlocks) {
      if (block.tag && !['p', 'li', 'blockquote'].includes(block.tag)) continue; // skip headings
      if (block.text.length < 60) continue; // skip fragments (bylines, captions)
      const first = splitSentences(block.text)[0];
      if (first) picked.push(first.text);
      if (picked.length >= maxSentences) break;
    }
    if (picked.length > 0) {
      const ref = rules.presentationRefs.summaries;
      annotations.push({
        id: nextId(),
        kind: 'summary',
        anchor: { selectors: [documentSelector()], status: 'document' },
        body: { value: picked.join(' '), format: 'text/plain' },
        reasoning:
          `Rule-based extractive summary: the first sentence of each of the leading ${picked.length} ` +
          `substantial text blocks, quoted verbatim and concatenated. This engine runs at the ` +
          `rule-based capability tier and performs no abstractive summarization. Produced because ` +
          `the manifest presentation setting 'summaries' is '${rules.presentation.summaries}'` +
          (ref ? ` (${ref}).` : ' (schema default; the manifest does not set it explicitly).'),
        ...(ref ? { manifestRefs: [ref] } : {})
      });
    }
  }

  // --- 2. Source-policy evidence indicators (document level) ---------------
  // Surfaces the user's own trust/distrust policy for the page origin.
  // A pointer to the user's source list — never a truth verdict (ADR-0007).
  if (rules.presentation.evidenceIndicators) {
    const origin = pageOrigin(url);
    const sides = [
      { list: rules.trusted, label: 'trusted' },
      { list: rules.distrusted, label: 'distrusted' }
    ];
    for (const { list, label } of sides) {
      for (const src of list) {
        if (annotations.length >= MAX_ANNOTATIONS) break;
        if (!matchesOrigin(url, src.origin)) continue;
        annotations.push({
          id: nextId(),
          kind: 'evidence-indicator',
          anchor: { selectors: [documentSelector()], status: 'document' },
          body: {
            value: `This page's origin matches "${src.origin}" on your ${label} source list (weight ${src.weight}).`,
            format: 'text/plain'
          },
          basis: [
            {
              type: 'source',
              ...(origin ? { uri: origin } : {}),
              description:
                `Page origin matches the ${label} source entry "${src.origin}"` +
                (src.note ? ` — your note: "${src.note}".` : '.')
            }
          ],
          reasoning:
            `Source-policy rule: the page URL's origin matches the entry "${src.origin}" in your ` +
            `manifest's ${label} source list (${src.manifestRef}, weight ${src.weight}` +
            (src.note ? `, note: "${src.note}"` : '') +
            `). This indicator surfaces your own declared source policy; it is not a statement ` +
            `about whether this page's content is true or false.`,
          manifestRefs: [src.manifestRef]
        });
      }
    }
  }

  // --- 3. Priority-term highlights -----------------------------------------
  // Positive-weight priorities produce highlights. Negative weights express
  // de-emphasis, which at this tier only lowers overlay prominence (i.e. no
  // highlight is produced); de-emphasis is never a content filter.
  if (rules.presentation.annotations) {
    const perPriority = new Map();
    for (const block of textBlocks) {
      if (annotations.length >= MAX_ANNOTATIONS) break;
      for (const priority of rules.priorities) {
        if (annotations.length >= MAX_ANNOTATIONS) break;
        if (priority.weight <= 0) continue;
        const used = perPriority.get(priority.manifestRef) || 0;
        if (used >= MAX_HIGHLIGHTS_PER_PRIORITY) continue;
        const m = priority.pattern.exec(block.text);
        if (!m) continue;
        perPriority.set(priority.manifestRef, used + 1);
        const start = m.index;
        const end = m.index + m[0].length;
        annotations.push({
          id: nextId(),
          kind: 'highlight',
          anchor: {
            selectors: [buildTextQuoteSelector(block.text, start, end)],
            status: 'exact'
          },
          body: {
            value: `Matches your priority "${priority.topic}" (weight ${priority.weight}).`,
            format: 'text/plain'
          },
          reasoning:
            `Priority rule: the text "${m[0]}" matches your priority topic "${priority.topic}" ` +
            `with weight ${priority.weight} (${priority.manifestRef})` +
            (priority.rationale ? `; your recorded rationale: "${priority.rationale}"` : '') +
            `. Term matching is literal and case-insensitive at the rule-based tier.`,
          manifestRefs: [priority.manifestRef]
        });
      }
    }
  }

  // --- 4. requireProvenance: 'citations' ------------------------------------
  // The manifest asks for the citations provenance signal to be surfaced when
  // absent. Rule-based heuristic: a sentence containing a number or percentage
  // inside a block that has no hyperlinks. This is a shallow textual signal —
  // absence of a link is not evidence that a claim is wrong — and every
  // reasoning trace says so.
  const citationsRule = rules.requireProvenance.find((r) => r.signal === 'citations');
  if (citationsRule && rules.presentation.evidenceIndicators) {
    let emitted = 0;
    for (const block of textBlocks) {
      if (annotations.length >= MAX_ANNOTATIONS || emitted >= MAX_CITATION_INDICATORS) break;
      const linkCount = typeof block.linkCount === 'number' ? block.linkCount : 0;
      if (linkCount > 0) continue;
      if (block.tag && !['p', 'li', 'blockquote'].includes(block.tag)) continue;
      const sentence = splitSentences(block.text).find((s) => CLAIM_PATTERN.test(s.text));
      if (!sentence) continue;
      emitted += 1;
      annotations.push({
        id: nextId(),
        kind: 'evidence-indicator',
        anchor: {
          selectors: [buildTextQuoteSelector(block.text, sentence.start, sentence.end)],
          status: 'exact'
        },
        body: {
          value: 'Quantitative claim with no citation link in its passage.',
          format: 'text/plain'
        },
        basis: [
          {
            type: 'citation',
            description:
              'No hyperlink was found in the text block containing this sentence. Heuristic ' +
              'signal only: the absence of a link is not evidence that the claim is wrong, and ' +
              'this engine has not checked the claim itself.'
          }
        ],
        reasoning:
          `Provenance rule: your manifest requests the 'citations' provenance signal be surfaced ` +
          `when absent (${citationsRule.manifestRef}). Heuristic applied at the rule-based tier: ` +
          `this sentence contains a number or percentage and its containing block has no ` +
          `hyperlinks. This is a shallow textual heuristic about citation presence, not a ` +
          `judgment about the claim's accuracy.`,
        manifestRefs: [citationsRule.manifestRef]
      });
    }
  }

  return {
    lenspub: '0.1',
    type: 'InterpretationResult',
    target: {
      source: url,
      ...(title ? { title } : {}),
      contentHash: 'fnv1a32:' + fnv1a32(textBlocks.map((b) => b.text).join('\n'))
    },
    lens: {
      ...(rules.lens.id ? { id: rules.lens.id } : {}),
      lensVersion: rules.lens.lensVersion
    },
    envelope: options.envelope || buildEnvelope(),
    annotations
  };
}
