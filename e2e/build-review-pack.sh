#!/usr/bin/env bash
#
# Build a visual review pack from the approval-matrix screenshots.
#
# For each resolution and each layout, produces one labelled contact sheet
# (that layout across all background types) under:
#   e2e/screenshots/matrix/_review/<resolution>/<layout>.jpg
# and copies the review prompt alongside, so the whole pack can be handed to a
# vision model (see e2e/visual-review-prompt.md).
#
# Requires ImageMagick (`montage`). Run AFTER `pnpm test:e2e:matrix`.
# Usage: pnpm run review:pack   (or: bash e2e/build-review-pack.sh)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MATRIX_DIR="$ROOT/e2e/screenshots/matrix"
PROMPT="$ROOT/e2e/visual-review-prompt.md"
OUT_ROOT="$MATRIX_DIR/_review"

if ! command -v montage >/dev/null 2>&1; then
  echo "error: ImageMagick 'montage' not found. Install ImageMagick." >&2
  exit 1
fi
if [ ! -d "$MATRIX_DIR" ]; then
  echo "error: no matrix screenshots at $MATRIX_DIR — run 'pnpm test:e2e:matrix' first." >&2
  exit 1
fi

# ImageMagick needs an explicit font file for labels (its default-font lookup is
# unreliable). Pick the first that exists (macOS, then common Linux/CI paths).
FONT=""
for f in \
  /System/Library/Fonts/Supplemental/Arial.ttf \
  /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf \
  /usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf \
  /usr/share/fonts/dejavu/DejaVuSans.ttf ; do
  if [ -e "$f" ]; then FONT="$f"; break; fi
done
font_args=()
if [ -n "$FONT" ]; then
  font_args=( -font "$FONT" )
else
  echo "warning: no TTF font found — building sheets without labels." >&2
fi

rm -rf "$OUT_ROOT"
mkdir -p "$OUT_ROOT"
cp "$PROMPT" "$OUT_ROOT/REVIEW-PROMPT.md"

sheet_count=0
for res_dir in "$MATRIX_DIR"/*/; do
  res="$(basename "$res_dir")"
  [ "$res" = "_review" ] && continue
  # collect distinct layout prefixes (filename is <layout>__<background>.jpg)
  layouts="$(find "$res_dir" -maxdepth 1 -name '*__*.jpg' -exec basename {} \; \
            | sed 's/__.*//' | sort -u)"
  [ -z "$layouts" ] && continue
  mkdir -p "$OUT_ROOT/$res"

  for layout in $layouts; do
    args=()
    for f in "$res_dir$layout"__*.jpg; do
      [ -e "$f" ] || continue
      bg="$(basename "$f" .jpg | sed "s/^${layout}__//")"
      if [ -n "$FONT" ]; then args+=( -label "$bg" ); fi
      args+=( "$f" )
    done
    [ "${#args[@]}" -eq 0 ] && continue
    title_args=()
    if [ -n "$FONT" ]; then title_args=( -title "$layout  —  $res" ); fi
    # Tiles are downscaled to 460px wide, so 4K sources become small here too.
    montage "${args[@]}" \
      "${font_args[@]}" \
      "${title_args[@]}" \
      -tile 4x \
      -geometry 460x+8+8 \
      -background '#0a0a0b' \
      -fill '#e4e4e7' \
      -pointsize 16 \
      -quality 82 \
      "$OUT_ROOT/$res/$layout.jpg"
    sheet_count=$((sheet_count + 1))
    echo "  built $res/$layout.jpg"
  done
done

echo "Review pack: $sheet_count contact sheets in $OUT_ROOT (+ REVIEW-PROMPT.md)"
