# LensPub Reading Lab

An extension-free browser harness around the existing [reference engine](../README.md). It uses the same compiler, interpreter, anchoring functions, schema validator, and Reproducibility Envelope. It does not change the normative specification or the extension.

## Run the demo

From the repository root, with Node 18 or later:

```sh
npm run demo
```

Open **http://localhost:4173/reader/**. No dependency installation, build step, service account, extension, or API key is needed to run the demo. `PORT` changes the port; `HOST` changes the default loopback binding. Stop the server with Ctrl+C. The static host exposes only reader assets and engine modules, not the repository.

For a portable package (requires Python 3), run `npm run demo:package` and extract `dist/lenspub-reader.zip`. Run `node scripts/serve-reader.mjs` from the extracted directory, then open the same address. The archive includes its own instructions and license.

## One interaction to try

1. Read the bundled fictional article. The applied daily lens produces three priority highlights, one extractive summary, and one citation-presence signal.
2. Click **Why?** beside an annotation. Inspect its reasoning, manifest field, anchor status, and local rule-based Reproducibility Envelope. Escape closes the dialog and restores focus.
3. Choose **Citation signals**, then **Preview changes**. Review the counts, changed priorities, and resulting annotations. The reading view still uses the applied lens.
4. **Apply lens** changes only the overlay. **Undo** restores the previous lens. **Hide overlays** exposes the original view.
5. **Use your text** accepts plain text. HTML is inert text; no URL is fetched. **Export lens** exports only the applied Lens Manifest. **Import lens** validates and stages a candidate for explicit review and Apply.

## Boundaries

Everything runs in this tab. There is no storage, telemetry, reading history, network API, cloud capture, remote model, or model-generated UI. Reload deliberately restores the bundled demo. Reset also clears undo history and pasted input. Pending imports are invalidated by newer interactions, preventing stale asynchronous reads from replacing a draft.

The article is adapted from the existing [fictional demo fixture](../demo/demo.html). Its citation links target a local illustrative note, not real reports. Pasted text carries no hyperlink metadata, so the citation heuristic will treat all pasted paragraphs as linkless. Source identity is `about:blank`; neither mode claims a trusted publisher origin.

CSS Custom Highlights paint ranges without wrapping, rewriting, hiding, or reordering source nodes. Browsers without that API retain the separate annotation panel and display an explicit fallback notice. The interface supports keyboard navigation, dialog focus restoration, and narrow screens. Browser QA currently covers Chromium; other browser engines have not been exercised.

The controls perform manual edits, not automatic learning, protocol Lens Change Proposals, or a conformant Lens Diff. Local edits bump the patch version and discard publisher identity, stale modification metadata, proof, and version history. Import preserves the supplied manifest until explicitly edited. The UI does not verify signatures, execute subscriptions, classify Domain Scopes, or honor remote-execution requests. The engine's existing rule-tier limits still apply (including 50 annotations and literal topic matching).

Exports never add article text, results, or reading events. The existing manifest validator does not semantically detect reading history hidden in arbitrary free text or extension values. Imported text remains user-supplied: inspect it before sharing. The demo is not a privacy scrubber for arbitrary imported manifests.

No reordering is implemented. [ADR-0011](../../adr/0011-overlay-invariants-bind-to-authored-content.md) remains Proposed; this demo does not depend on it.

## Browser regression checks

```sh
npm ci
npx playwright install chromium
npm run test:browser
```

If Chromium is already installed, use `CHROMIUM_PATH=/path/to/chromium npm run test:browser`. The test runner starts and stops an isolated loopback server on port 4174 (`QA_PORT` overrides it). Screenshots are written to `dist/reader-qa/`.

The scenarios cover first render, keyboard Why/Escape, preview/apply/undo/cancel, keyboard range controls, repeated switching, source DOM preservation, export/import, malformed/oversized/history-bearing inputs, canceled input, stale asynchronous file reads, inert untrusted content, reset/reload, mobile overflow, skip navigation, network/storage absence, and static-host path restrictions.

The five existing repository checks remain separate: `npm test`, `npm run validate`, `npm run check-links`, `npm run conformance`, and `npm run conformance:self-test`.
