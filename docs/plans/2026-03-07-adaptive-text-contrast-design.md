# Adaptive Text Contrast

## Problem

Text color is chosen by a simple luminance threshold (0.35 for vibrant gradients, 0.4 for regular colors) instead of checking actual contrast against the background. Light album art produces a light gradient but white text is still selected, resulting in white-on-white unreadable text.

## Solution

Replace the luminance threshold checks in both `generateVibrantGradient()` and `generateColors()` with a WCAG contrast ratio calculation. If white text doesn't meet AA contrast (4.5:1) against the background, switch to dark text.

## Changes

All changes are scoped to `packages/client/src/composables/colorUtils.ts`:

1. **Add `getContrastRatio(bg, fg)` utility** using the existing `getLuminance()` function. Formula: `(L1 + 0.05) / (L2 + 0.05)` where L1 is the lighter luminance.
2. **`generateVibrantGradient()` (~line 411):** Replace `luminance > 0.35` with a contrast ratio check of white text against the gradient's center color. If ratio < 4.5:1, use dark text.
3. **`generateColors()` (~line 457):** Same replacement — check contrast ratio against the primary background color.
4. **Keep existing text color values** (`#f5f5f5` / `#1a1a1a`) and opacity variants unchanged — only the selection logic changes.
5. **Minimum contrast ratio:** 4.5:1 (WCAG AA for normal text).

## What doesn't change

- No layout file changes — all layouts consume `--text-color` via CSS variables from `useBackgroundStyle.ts`.
- No changes to gradient generation — backgrounds stay true to album art colors.
- FactsCarouselLayout and FactsOverlayLayout (dark overlay + white text) stay as-is since their overlays guarantee contrast.
