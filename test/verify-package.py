#!/usr/bin/env python3
"""Verify the original files in a local development source package."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
manifest = json.loads((root / 'MANIFEST.json').read_text())
errors = []
for item in manifest['files']:
    path = root / item['path']
    if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != item['sha256']:
        errors.append(item['path'])
if errors:
    raise SystemExit('Changed or missing package files:\n' + '\n'.join(errors))
print(f"Verified {len(manifest['files'])} original package files.")
