#!/bin/bash
set -e
cd "$(dirname "$0")"
mkdir -p dist

echo "Compiling src/app.jsx..."
./tools/esbuild src/app.jsx \
  --bundle \
  --format=iife \
  --minify \
  --sourcemap=inline \
  --outfile=dist/app.js

echo "Injecting into template..."
python3 -c "
tpl = open('index.html').read()
bundle = open('dist/app.js').read()
out = tpl.replace('<!-- BUILD:APP -->', '<script>' + bundle + '</script>')
open('dist/index.html', 'w').write(out)
kb = len(out) // 1024
print(f'Built dist/index.html ({kb} KB)')
"

# Keep preview server in sync
cp dist/index.html /tmp/index.html
echo "Preview synced to /tmp/index.html"
