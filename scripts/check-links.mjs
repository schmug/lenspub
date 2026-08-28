#!/usr/bin/env node
// Verifies that every relative cross-reference in the repository's Markdown
// resolves — the "every cross-reference resolves" half of the Phase 0 exit
// criteria in docs/roadmap.md, which nothing else checks.
//
// Checks relative file targets and, where a target carries a #fragment into a
// Markdown file, that a heading with that slug exists. External links
// (http, https, mailto, tel) are listed but not fetched: this script makes no
// network requests, consistent with the repository's local-only posture.
//
// Usage: npm run check-links   (or: node scripts/check-links.mjs)
// Licensed Apache-2.0 (see /LICENSE.md).

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', '.git', '.claude', 'dist', '.tmp']);
const EXTERNAL = /^(https?:|mailto:|tel:|data:|#!)/i;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (extname(full) === '.md') out.push(full);
  }
  return out;
}

// GitHub's heading-slug rules: strip inline formatting, lowercase, drop
// everything that is not alphanumeric / space / hyphen / underscore, then
// collapse spaces to hyphens. Repeats get a numeric suffix.
function slugsOf(markdown) {
  const seen = new Map();
  const slugs = new Set();
  for (const line of stripFences(markdown).split('\n')) {
    const m = line.match(/^#{1,6}\s+(.*?)\s*#*\s*$/);
    if (!m) continue;
    const base = m[1]
      .replace(/`([^`]*)`/g, '$1')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_~]/g, '')
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    slugs.add(n === 0 ? base : `${base}-${n}`);
  }
  return slugs;
}

// Links inside fenced code blocks are examples, not references.
function stripFences(markdown) {
  return markdown.replace(/^```[\s\S]*?^```/gm, '').replace(/^~~~[\s\S]*?^~~~/gm, '');
}

function linksOf(markdown) {
  const found = [];
  const lines = stripFences(markdown).split('\n');
  lines.forEach((line, i) => {
    // inline links and images: [text](target) / ![alt](target)
    for (const m of line.matchAll(/!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
      found.push({ target: m[1], line: i + 1 });
    }
    // reference definitions: [label]: target
    const ref = line.match(/^\s{0,3}\[[^\]]+\]:\s*<?([^\s>]+)>?/);
    if (ref) found.push({ target: ref[1], line: i + 1 });
  });
  return found;
}

const slugCache = new Map();
function slugsFor(file) {
  if (!slugCache.has(file)) slugCache.set(file, slugsOf(readFileSync(file, 'utf8')));
  return slugCache.get(file);
}

const files = walk(root).sort();
const broken = [];
let checked = 0, external = 0;

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  for (const { target, line } of linksOf(source)) {
    if (EXTERNAL.test(target)) { external++; continue; }

    const [pathPart, fragment] = target.split('#');
    const where = `${relative(root, file)}:${line}`;

    // Pure same-file fragment: [text](#some-heading)
    if (pathPart === '') {
      if (fragment && !slugsFor(file).has(decodeURIComponent(fragment))) {
        broken.push({ where, target, reason: 'no heading with that anchor in this file' });
      }
      checked++;
      continue;
    }

    const resolved = resolve(dirname(file), decodeURIComponent(pathPart));
    if (!existsSync(resolved)) {
      broken.push({ where, target, reason: `no such file: ${relative(root, resolved)}` });
      checked++;
      continue;
    }
    if (fragment && extname(resolved) === '.md' && !slugsFor(resolved).has(decodeURIComponent(fragment))) {
      broken.push({ where, target, reason: `no heading "#${fragment}" in ${relative(root, resolved)}` });
    }
    checked++;
  }
}

for (const b of broken) console.error(`BROKEN  ${b.where}\n        ${b.target} — ${b.reason}`);

console.log(
  `${checked} relative cross-reference${checked === 1 ? '' : 's'} in ${files.length} Markdown files: ` +
  `${checked - broken.length} resolve, ${broken.length} broken. ` +
  `(${external} external links listed, not fetched.)`
);
process.exit(broken.length ? 1 : 0);
