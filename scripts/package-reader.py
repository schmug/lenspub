# SPDX-License-Identifier: Apache-2.0
"""Create a dependency-free runnable reader package using Python's standard library."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root = Path(__file__).resolve().parent.parent
output = root / 'dist' / 'lenspub-reader.zip'
output.parent.mkdir(exist_ok=True)
with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
    for folder in ('poc/reader', 'poc/engine'):
        for source in sorted((root / folder).iterdir()):
            if source.suffix in ('.html', '.css', '.js', '.svg'):
                archive.write(source, source.relative_to(root))
    for name in ('scripts/serve-reader.mjs', 'LICENSE-CODE'):
        archive.write(root / name, name)
    archive.writestr('README.txt', '''LensPub Reading Lab — rule-based browser demo

Requires Node 18 or later. No install, API key, extension, or account.
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
