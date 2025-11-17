#!/usr/bin/env bash
# Precompress common static assets for Netlify so they can be served with brotli/gzip
# Run from repo root before deploy. Netlify will serve .br/.gz files when available.

set -eu

# find brotli and gzip
command -v brotli >/dev/null 2>&1 || echo "Warning: brotli not found; install brotli for .br files"
command -v gzip >/dev/null 2>&1 || echo "Warning: gzip not found; gzip is usually available"

EXTS=(js css html json wasm epw epk png jpg jpeg svg)
MAX_PARALLEL=4

echo "Precompressing assets..."

# iterate files and compress
find . -type f \( \
$(printf "%s\n" "" | sed -n '1,1p')
\) -print >/dev/null 2>&1 || true

for ext in "${EXTS[@]}"; do
  echo "Compressing *.$ext"
  find . -type f -iname "*.$ext" -not -path "./.git/*" -not -path "./node_modules/*" | while read -r file; do
    # skip already compressed
    if [[ -f "$file.br" || -f "$file.gz" ]]; then
      continue
    fi
    # gzip
    if command -v gzip >/dev/null 2>&1; then
      gzip -9 -c "$file" >"$file.gz" || true
    fi
    # brotli
    if command -v brotli >/dev/null 2>&1; then
      brotli -q 11 -f -o "$file.br" "$file" || true
    fi
  done
done

echo "Precompression finished. Upload the repository to Netlify (include .br/.gz files)."

exit 0
