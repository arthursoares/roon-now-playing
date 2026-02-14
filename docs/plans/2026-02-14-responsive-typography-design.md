# Responsive Typography with Container Queries

**Date:** 2026-02-14
**Status:** Approved
**Priority:** Tablets first, then TVs/monitors

## Problem

Current typography approach has issues across viewport sizes:
- Fonts too small on large displays (4K TVs)
- Fonts too large on small displays (tablets)
- Layout breaks at certain sizes
- Inconsistent values across layouts

Root causes:
- `clamp()` with `vw` units scales to viewport, not component
- No shared design tokens — each layout defines its own CSS variables
- Mixed units (`px` vs `rem`)
- Inconsistent breakpoints across layouts

## Solution

Centralized design tokens + CSS container queries.

### Typography Scale

1.25 ratio (major third), rem-based:

| Token | Size | Use Case |
|-------|------|----------|
| `--text-xs` | 0.64rem (10px) | Zone hints, timestamps |
| `--text-sm` | 0.8rem (13px) | Secondary info |
| `--text-base` | 1rem (16px) | Body text |
| `--text-lg` | 1.25rem (20px) | Artist/album |
| `--text-xl` | 1.563rem (25px) | Titles |
| `--text-2xl` | 1.953rem (31px) | Facts (tablet) |
| `--text-3xl` | 2.441rem (39px) | Facts (desktop) |
| `--text-4xl` | 3.052rem (49px) | Facts (TV) |
| `--text-5xl` | 3.815rem (61px) | Facts (4K) |

### Container Query Breakpoints

Based on component width, not viewport:

| Breakpoint | Container Width | Target Devices | Fact Size |
|------------|-----------------|----------------|-----------|
| `sm` | < 500px | Phone, narrow sidebar | `text-lg` |
| `md` | 500-699px | Small tablet, split view | `text-xl` |
| `lg` | 700-999px | iPad landscape, small monitor | `text-2xl` |
| `xl` | 1000-1399px | Desktop, 1080p TV | `text-3xl` |
| `2xl` | ≥ 1400px | 4K TV, large monitor | `text-4xl` |

### File Structure

```
packages/client/src/
├── styles/
│   └── tokens.css          # New: shared typography tokens
├── main.ts                  # Import tokens.css
└── layouts/
    ├── FactsColumnsLayout.vue   # Add container-type, use tokens
    └── ...
```

## Migration Strategy

### Phase 1: Foundation
- Create `packages/client/src/styles/tokens.css`
- Import in `main.ts`

### Phase 2: Migrate Layouts (priority order)
1. `FactsColumnsLayout.vue` — most complex, tablets priority
2. `FactsOverlayLayout.vue`
3. `FactsCarouselLayout.vue`
4. `DetailedLayout.vue`
5. `AmbientLayout.vue`
6. `MinimalLayout.vue`
7. `CoverLayout.vue`
8. `FullscreenLayout.vue`
9. `BasicLayout.vue`

### Phase 3: Cleanup
- Remove per-layout `--font-*` custom properties
- Delete `TypographyTestView.vue` and its route

## Implementation Notes

Each layout migration involves:
1. Add `container-type: inline-size` to root element
2. Replace `clamp()` font sizes with token + container query rules
3. Test on tablet, desktop, and TV viewports
4. Verify no visual regressions

## Browser Support

Container queries: 95%+ global support (Chrome 105+, Safari 16+, Firefox 110+).
No polyfill needed for this project's target devices.
