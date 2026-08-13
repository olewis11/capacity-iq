#!/bin/bash
# dev.sh — rebuild on source file changes using fswatch
set -e
cd "$(dirname "$0")"

echo "Starting dev watcher (Ctrl-C to stop)..."
./build.sh

fswatch -o src/ index.html | while read event; do
  echo "Change detected — rebuilding..."
  ./build.sh
done
