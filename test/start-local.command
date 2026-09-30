#!/bin/zsh
set -e
cd "$(dirname "$0")/.."
if [[ -x /opt/homebrew/bin/python3.12 ]]; then
  nma_python=/opt/homebrew/bin/python3.12
else
  nma_python=$(command -v python3)
fi
"$nma_python" test/env.py up local
open 'http://localhost:18086/__env/'
