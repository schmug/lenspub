// SPDX-License-Identifier: Apache-2.0
// Portable file:// build of the same reader and engine; no runtime dependencies.
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const result = await build({
  entryPoints: [fileURLToPath(new URL('poc/reader/reader.js', root))],
  bundle: true, write: false, format: 'iife', platform: 'browser',
  target: ['chrome105'], charset: 'utf8', legalComments: 'inline'
});
const script = result.outputFiles[0].text;
const style = await readFile(new URL('poc/reader/reader.css', root), 'utf8');
if (/<\/script/i.test(script) || /<\/style/i.test(style)) {
  throw new Error('Unexpected raw HTML closing tag in bundled source');
}
const hash = (text) => createHash('sha256').update(text).digest('base64');
// Hash authorization is narrower than the served version's self-source policy:
// only these exact build bytes can execute; no unsafe-inline/eval or network.
const policy = `default-src 'none'; script-src 'sha256-${hash(script)}'; style-src 'sha256-${hash(style)}'; connect-src 'none'; img-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'`;
let html = await readFile(new URL('poc/reader/index.html', root), 'utf8');
const replaceOnce = (search, replacement) => {
  if (!html.includes(search)) throw new Error(`Reader template no longer contains ${search}`);
  html = html.replace(search, () => replacement);
};
html = html.replace(/content="default-src [^"]*"/, () => `content="${policy}"`);
replaceOnce('<link rel="icon" href="icon.svg">', '');
replaceOnce('<link rel="stylesheet" href="reader.css">', `<style>${style}</style>`);
replaceOnce('<script type="module" src="reader.js"></script>', '');
// Empty relative href reloads this file even if the download has been renamed.
replaceOnce('class="brand" href="./"', 'class="brand" href=""');
replaceOnce('</body>', `<script>${script}</script></body>`);
await mkdir(new URL('dist/', root), {recursive:true});
const output = new URL('dist/lenspub-reader.html', root);
await writeFile(output, html);
console.log(fileURLToPath(output));
