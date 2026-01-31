# Background Types Design

**Date:** 2026-01-31
**Status:** Approved

## Overview

Extend the existing `BackgroundType` setting with 11 new options that leverage color extraction and artwork processing. Users select ONE background type from a unified list in the Admin panel or via URL parameter.

## Background Types

| Category | Type | Description |
|----------|------|-------------|
| Existing | `solid` | Solid black or white |
| Existing | `extracted` | Single dominant color |
| **Gradient** | `gradient-linear` | 2-color vertical gradient |
| **Gradient** | `gradient-linear-multi` | 3-5 color vertical gradient |
| **Gradient** | `gradient-radial` | 2-color radial from center |
| **Gradient** | `gradient-radial-corner` | 2-color radial from corner |
| **Gradient** | `gradient-mesh` | Multi-point organic blend |
| **Artwork** | `blur-subtle` | Artwork at 20px blur |
| **Artwork** | `blur-heavy` | Artwork at 60px blur |
| **Artwork** | `duotone` | Artwork with 2-color overlay |
| **Artwork** | `posterized` | Artwork with reduced colors |
| **Textured** | `gradient-noise` | Linear gradient + noise texture |
| **Textured** | `blur-grain` | Blurred artwork + film grain |

### URL Parameter

`?background=gradient-mesh` (extends existing `?background=` param)

### Layout Support

All layouts support all background types. Some combinations may look unusual (e.g., blurred artwork behind fullscreen artwork), but users have full flexibility.

## Color Extraction Enhancements

The current `useColorExtraction` composable extracts a single dominant color. To support multi-color gradients and mesh, it returns a full palette.

### Enhanced Output

```typescript
interface ExtractedPalette {
  dominant: string;        // Primary color (existing)
  palette: string[];       // 3-5 ranked colors
  isDark: boolean;         // Light/dark mode (existing)
  textColor: string;       // Contrasting text color (existing)
}
```

### Extraction Algorithm Changes

1. Sample artwork at 50×50 (unchanged)
2. Group pixels into 12 hue buckets (unchanged)
3. **New:** Keep top 5 buckets instead of just the dominant
4. **New:** For each bucket, calculate average saturation/lightness
5. **New:** Sort by pixel count, return as `palette[]`
6. Filter out near-duplicates (colors within 15° hue of each other)

### Palette Usage by Type

| Background Type | Colors Used |
|-----------------|-------------|
| `gradient-linear` | `palette[0]` → darker variant |
| `gradient-linear-multi` | `palette[0..2]` or `palette[0..4]` |
| `gradient-radial` | `palette[0]` center → `palette[1]` edge |
| `gradient-mesh` | `palette[0..4]` as mesh points |
| `duotone` | `palette[0]` + `palette[1]` |

## Background Rendering Implementation

Each background type renders differently. All are CSS-based for performance.

### Gradient Types

| Type | CSS Approach |
|------|--------------|
| `gradient-linear` | `linear-gradient(to bottom, color1, color1-darkened)` |
| `gradient-linear-multi` | `linear-gradient(to bottom, color1 0%, color2 50%, color3 100%)` |
| `gradient-radial` | `radial-gradient(circle at center, color1, color2)` |
| `gradient-radial-corner` | `radial-gradient(circle at top left, color1, color2)` |
| `gradient-mesh` | Multiple layered `radial-gradient` with transparency, positioned at different points |

### Artwork-Based Types

| Type | Implementation |
|------|----------------|
| `blur-subtle` | `<img>` with `filter: blur(20px)` scaled 110% to hide edges |
| `blur-heavy` | `<img>` with `filter: blur(60px)` scaled 120% |
| `duotone` | `<img>` with `filter: grayscale(1)` + CSS `mix-blend-mode` overlay using two palette colors |
| `posterized` | `<img>` with `filter: contrast(1.5) saturate(1.2)` + SVG filter for color reduction |

### Textured Types

| Type | Implementation |
|------|----------------|
| `gradient-noise` | Gradient + pseudo-element with noise SVG/PNG at low opacity (5-10%) |
| `blur-grain` | Blurred artwork + pseudo-element with film grain texture |

All artwork-based backgrounds reuse the existing artwork `<img>` element, just styled differently.

## File Structure & Changes

### New Files

| File | Purpose |
|------|---------|
| `packages/client/src/composables/useBackground.ts` | Background rendering logic, switches on type |
| `packages/client/src/components/DynamicBackground.vue` | Wrapper component all layouts use |
| `packages/client/src/assets/noise.svg` | Tileable noise texture for grain effects |

### Modified Files

| File | Change |
|------|--------|
| `packages/shared/src/index.ts` | Add new `BackgroundType` values to the union type |
| `packages/client/src/composables/useColorExtraction.ts` | Return full palette instead of single color |
| `packages/client/src/composables/usePreferences.ts` | Handle new background type values |
| `packages/client/src/layouts/*.vue` | Replace inline background logic with `<DynamicBackground>` component |
| `packages/client/src/views/AdminView.vue` | Update background dropdown with grouped options |

### Component Usage

Each layout switches from inline background styling to:

```vue
<template>
  <DynamicBackground :type="background" :artwork="artworkUrl" :palette="palette">
    <!-- layout content -->
  </DynamicBackground>
</template>
```

This centralizes all background logic in one place rather than duplicating across layouts.

## Admin UI Changes

### Grouped Dropdown

```
Background Type: [dropdown]
├─ Basic
│  ├─ Solid
│  └─ Extracted Color
├─ Gradients
│  ├─ Linear (Simple)
│  ├─ Linear (Multi-color)
│  ├─ Radial (Center)
│  ├─ Radial (Corner)
│  └─ Mesh
├─ Artwork
│  ├─ Blur (Subtle)
│  ├─ Blur (Heavy)
│  ├─ Duotone
│  └─ Posterized
└─ Textured
   ├─ Gradient + Noise
   └─ Blur + Grain
```

### Implementation

Use `<optgroup>` elements within the existing `<select>` for native grouping. No additional UI components needed.

### Live Preview

The existing Admin preview area already shows the current layout. Background changes apply immediately so users see the effect in real-time.

### Default Value

Keep `extracted` as the default for backwards compatibility. Existing users see no change unless they opt into new options.

## Transitions & Performance

### Background Transitions

When track changes and colors update:
- Crossfade transition: 500ms (matches existing artwork transition)
- CSS: `transition: background 500ms ease-in-out, filter 500ms ease-in-out`
- Artwork-based backgrounds crossfade the image itself

### Performance Considerations

| Concern | Mitigation |
|---------|------------|
| Blur is GPU-intensive | Use `will-change: filter` hint; blur is static per track, not animated |
| Mesh gradient complexity | Limit to 4-5 radial layers; pre-calculate positions |
| Noise texture size | Use small tileable SVG (~2KB), repeat via CSS |
| Palette extraction cost | Run once per track change, cache result in composable |
| Multiple gradient layers | Use single element with layered `background-image` where possible |

### Mobile Considerations

- Blur effects may be slower on older devices
- Consider reducing blur radius on mobile (detect via viewport width)
- Mesh gradients render fine on mobile (just CSS)

### Fallback Behavior

If artwork fails to load, all artwork-based backgrounds fall back to `gradient-linear` using whatever palette is available (or default dark gradient if no palette).

## Out of Scope (Future Enhancements)

- Animated backgrounds (pulsing, aurora effects)
- Per-layout background overrides (all layouts share one setting)
- Custom color picker (always uses extracted colors)
- Background presets/themes
- Time-of-day or genre-aware backgrounds
