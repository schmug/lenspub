# SPDX-License-Identifier: Apache-2.0
"""Create a dependency-free runnable reader package using Python's standard library."""
from pathlib import Path
import subprocess
from zipfile import ZipFile, ZIP_DEFLATED
root = Path(__file__).resolve().parent.parent
subprocess.run(['node', str(root / 'scripts' / 'build-reader.mjs')], check=True)
output = root / 'dist' / 'lenspub-reader.zip'
output.parent.mkdir(exist_ok=True)
with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
    archive.write(root / 'dist' / 'lenspub-reader.html', 'lenspub-reader.html')
    for folder in ('reader-qa', 'reader-file-qa'):
        for evidence in sorted((root / 'dist' / folder).glob('*')):
            if evidence.is_file() and evidence.suffix in ('.jpg', '.txt'):
                archive.write(evidence, 'evidence/' + folder + '/' + evidence.name)
    for folder in ('poc/reader', 'poc/engine'):
        for source in sorted((root / folder).iterdir()):
            if source.suffix in ('.html', '.css', '.js', '.svg'):
                archive.write(source, source.relative_to(root))
    for name in ('scripts/serve-reader.mjs', 'LICENSE-CODE'):
        archive.write(root / name, name)
    archive.writestr('README.txt', '''LensPub Reading Lab — rule-based browser demo

Double-click lenspub-reader.html to open in a modern browser.
No Node, install, API key, extension, or account needed for the HTML file.
The single file contains the actual engine and hash-authorized code/styles.
Network connections and unauthorized scripts remain blocked by CSP.

Optional HTTP server mode requires Node 18 or later.
From this extracted folder, run:

  node scripts/serve-reader.mjs

Then open http://localhost:4173/reader/ in a browser. Ctrl+C stops the server.
All interpretation is local. The article is fictional; paste your own plain
text using "Use your text". No live URL fetching or model inference occurs.
Reload resets the session. Export saves only the applied Lens Manifest.
Imported free text is preserved; inspect it before sharing.

Code: Apache-2.0; see LICENSE-CODE.
''')
print(output)
