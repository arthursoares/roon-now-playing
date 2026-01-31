# Background Types Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 11 new background types (gradients, artwork-based, textured) to extend the existing background system.

**Architecture:** Extend `colorUtils.ts` to extract a 5-color palette, update `useBackgroundStyle.ts` to handle all new background types, create a `DynamicBackground.vue` component for artwork-based backgrounds, and update the Admin UI with grouped options.

**Tech Stack:** Vue 3, TypeScript, CSS gradients/filters, Canvas API

---

## Task 1: Extend BackgroundType in Shared Package

**Files:**
- Modify: `packages/shared/src/index.ts:55-65`
- Test: `packages/shared/src/index.spec.ts`

**Step 1: Write the failing test**

Add test to `packages/shared/src/index.spec.ts`:

```typescript
describe('BACKGROUNDS', () => {
  it('should include all 13 background types', () => {
    expect(BACKGROUNDS).toContain('black');
    expect(BACKGROUNDS).toContain('white');
    expect(BACKGROUNDS).toContain('dominant');
    expect(BACKGROUNDS).toContain('gradient-radial');
    expect(BACKGROUNDS).toContain('gradient-linear');
    // New types
    expect(BACKGROUNDS).toContain('gradient-linear-multi');
    expect(BACKGROUNDS).toContain('gradient-radial-corner');
    expect(BACKGROUNDS).toContain('gradient-mesh');
    expect(BACKGROUNDS).toContain('blur-subtle');
    expect(BACKGROUNDS).toContain('blur-heavy');
    expect(BACKGROUNDS).toContain('duotone');
    expect(BACKGROUNDS).toContain('posterized');
    expect(BACKGROUNDS).toContain('gradient-noise');
    expect(BACKGROUNDS).toContain('blur-grain');
    expect(BACKGROUNDS.length).toBe(14);
  });

  it('should have display names for all background types', () => {
    for (const bg of BACKGROUNDS) {
      expect(BACKGROUND_CONFIG[bg]).toBeDefined();
      expect(BACKGROUND_CONFIG[bg].displayName).toBeTruthy();
    }
  });

  it('should have category for all background types', () => {
    for (const bg of BACKGROUNDS) {
      expect(BACKGROUND_CONFIG[bg].category).toMatch(/^(basic|gradient|artwork|textured)$/);
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- packages/shared/src/index.spec.ts`
Expected: FAIL - new background types not found

**Step 3: Update BACKGROUNDS and BACKGROUND_CONFIG**

In `packages/shared/src/index.ts`, replace lines 55-65:

```typescript
// Background options
export const BACKGROUNDS = [
  'black',
  'white',
  'dominant',
  'gradient-radial',
  'gradient-linear',
  'gradient-linear-multi',
  'gradient-radial-corner',
  'gradient-mesh',
  'blur-subtle',
  'blur-heavy',
  'duotone',
  'posterized',
  'gradient-noise',
  'blur-grain',
] as const;
export type BackgroundType = (typeof BACKGROUNDS)[number];

// Background display names and categories
export const BACKGROUND_CONFIG: Record<BackgroundType, { displayName: string; category: 'basic' | 'gradient' | 'artwork' | 'textured' }> = {
  'black': { displayName: 'Black', category: 'basic' },
  'white': { displayName: 'White', category: 'basic' },
  'dominant': { displayName: 'Dominant Color', category: 'basic' },
  'gradient-radial': { displayName: 'Radial Gradient', category: 'gradient' },
  'gradient-linear': { displayName: 'Linear Gradient', category: 'gradient' },
  'gradient-linear-multi': { displayName: 'Multi-color Linear', category: 'gradient' },
  'gradient-radial-corner': { displayName: 'Corner Radial', category: 'gradient' },
  'gradient-mesh': { displayName: 'Mesh Gradient', category: 'gradient' },
  'blur-subtle': { displayName: 'Blur (Subtle)', category: 'artwork' },
  'blur-heavy': { displayName: 'Blur (Heavy)', category: 'artwork' },
  'duotone': { displayName: 'Duotone', category: 'artwork' },
  'posterized': { displayName: 'Posterized', category: 'artwork' },
  'gradient-noise': { displayName: 'Gradient + Noise', category: 'textured' },
  'blur-grain': { displayName: 'Blur + Grain', category: 'textured' },
};
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- packages/shared/src/index.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/shared/src/index.ts packages/shared/src/index.spec.ts
git commit -m "feat(shared): add 11 new background types with categories"
```

---

## Task 2: Add Palette Extraction to colorUtils

**Files:**
- Modify: `packages/client/src/composables/colorUtils.ts`
- Test: `packages/client/src/composables/colorUtils.spec.ts`

**Step 1: Write the failing test**

Add to `packages/client/src/composables/colorUtils.spec.ts`:

```typescript
describe('extractColorPalette', () => {
  it('should return up to 5 colors sorted by prominence', () => {
    // Create image data with distinct color regions
    const imageData = createImageData(50, 50);
    // Fill with blue (dominant), red, green
    for (let i = 0; i < imageData.data.length; i += 4) {
      const pixel = i / 4;
      if (pixel < 1000) {
        // Blue - most pixels
        imageData.data[i] = 50;
        imageData.data[i + 1] = 100;
        imageData.data[i + 2] = 200;
      } else if (pixel < 1500) {
        // Red - second most
        imageData.data[i] = 200;
        imageData.data[i + 1] = 50;
        imageData.data[i + 2] = 50;
      } else {
        // Green - least
        imageData.data[i] = 50;
        imageData.data[i + 1] = 180;
        imageData.data[i + 2] = 50;
      }
      imageData.data[i + 3] = 255;
    }

    const palette = extractColorPalette(imageData);

    expect(palette.length).toBeGreaterThanOrEqual(3);
    expect(palette.length).toBeLessThanOrEqual(5);
    // First color should be blue-ish (hue around 210-230)
    expect(palette[0].h).toBeGreaterThan(180);
    expect(palette[0].h).toBeLessThan(250);
  });

  it('should filter out near-duplicate hues within 15 degrees', () => {
    const imageData = createImageData(50, 50);
    // Fill with two very similar blues
    for (let i = 0; i < imageData.data.length; i += 4) {
      const pixel = i / 4;
      if (pixel < 1250) {
        imageData.data[i] = 50;
        imageData.data[i + 1] = 100;
        imageData.data[i + 2] = 200;
      } else {
        imageData.data[i] = 60;
        imageData.data[i + 1] = 110;
        imageData.data[i + 2] = 210;
      }
      imageData.data[i + 3] = 255;
    }

    const palette = extractColorPalette(imageData);

    // Should dedupe to just one blue
    expect(palette.length).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- packages/client/src/composables/colorUtils.spec.ts`
Expected: FAIL - extractColorPalette not defined

**Step 3: Implement extractColorPalette**

Add to `packages/client/src/composables/colorUtils.ts` after `extractDominantColor`:

```typescript
/**
 * Extract a palette of up to 5 prominent colors from image data
 * Colors are sorted by prominence and filtered to remove near-duplicates
 */
export function extractColorPalette(imageData: ImageData, maxColors: number = 5): HSL[] {
  const pixels = imageData.data;
  const hueBuckets: { colors: HSL[]; count: number; saturationSum: number; lightnessSum: number }[] =
    Array.from({ length: HUE_BUCKETS }, () => ({ colors: [], count: 0, saturationSum: 0, lightnessSum: 0 }));

  // Sample pixels and group by hue
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];

    if (a < 128) continue;

    const hsl = rgbToHsl(r, g, b);

    // Only consider pixels with meaningful saturation
    if (hsl.s >= 10) {
      const bucketIndex = Math.floor(hsl.h / (360 / HUE_BUCKETS)) % HUE_BUCKETS;
      hueBuckets[bucketIndex].colors.push(hsl);
      hueBuckets[bucketIndex].count++;
      hueBuckets[bucketIndex].saturationSum += hsl.s;
      hueBuckets[bucketIndex].lightnessSum += hsl.l;
    }
  }

  // Score and sort buckets by prominence (count * average saturation)
  const scoredBuckets = hueBuckets
    .map((bucket, index) => ({
      bucket,
      index,
      score: bucket.count > 0 ? bucket.count * (bucket.saturationSum / bucket.count / 100) : 0,
    }))
    .filter(b => b.score > 0)
    .sort((a, b) => b.score - a.score);

  // Extract representative color from each bucket
  const palette: HSL[] = [];

  for (const { bucket } of scoredBuckets) {
    if (palette.length >= maxColors) break;
    if (bucket.colors.length === 0) continue;

    // Calculate weighted average for this bucket
    let weightedH = 0;
    let weightedS = 0;
    let weightedL = 0;
    let totalWeight = 0;

    for (const color of bucket.colors) {
      const weight = color.s / 100;
      weightedH += color.h * weight;
      weightedS += color.s * weight;
      weightedL += color.l * weight;
      totalWeight += weight;
    }

    if (totalWeight === 0) continue;

    const avgColor: HSL = {
      h: Math.round(weightedH / totalWeight),
      s: Math.round(weightedS / totalWeight),
      l: Math.round(weightedL / totalWeight),
    };

    // Check if this hue is too close to an existing palette color
    const isDuplicate = palette.some(existing => {
      const hueDiff = Math.abs(existing.h - avgColor.h);
      const wrappedDiff = Math.min(hueDiff, 360 - hueDiff);
      return wrappedDiff < 15;
    });

    if (!isDuplicate) {
      palette.push(avgColor);
    }
  }

  return palette;
}
```

Also update the export list at the bottom to include `extractColorPalette`.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- packages/client/src/composables/colorUtils.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/client/src/composables/colorUtils.ts packages/client/src/composables/colorUtils.spec.ts
git commit -m "feat(client): add extractColorPalette for multi-color backgrounds"
```

---

## Task 3: Update useColorExtraction to Return Palette

**Files:**
- Modify: `packages/client/src/composables/useColorExtraction.ts`
- Modify: `packages/client/src/composables/colorUtils.ts` (add ExtractedPalette interface)

**Step 1: Add ExtractedPalette interface to colorUtils.ts**

Add after `ExtractedColors` interface:

```typescript
export interface ExtractedPalette {
  dominant: HSL;
  palette: HSL[];
  paletteCSS: string[];
  isDark: boolean;
}
```

**Step 2: Update extractColors in useColorExtraction.ts**

Modify the `extractColors` function to also extract and return the palette:

```typescript
import {
  extractDominantColor,
  extractColorPalette,
  generateColors,
  generateVibrantGradient,
  hslToString,
  DEFAULT_LIGHT,
  SAMPLE_SIZE,
  type ExtractedColors,
  type ExtractedPalette,
  type HSL,
} from './colorUtils';

// Add to the return type of useColorExtraction
const palette = ref<ExtractedPalette>({
  dominant: { h: 220, s: 20, l: 50 },
  palette: [],
  paletteCSS: [],
  isDark: true,
});

// Inside extractColors function, after extractDominantColor:
const dominantColor = extractDominantColor(imageData);
const colorPalette = extractColorPalette(imageData, 5);
const paletteResult: ExtractedPalette = {
  dominant: dominantColor,
  palette: colorPalette,
  paletteCSS: colorPalette.map(c => hslToString(c.h, c.s, c.l)),
  isDark: dominantColor.l <= 50,
};

// Return palette from the function and expose it
return {
  colors,
  vibrantGradient,
  palette,
  previousColors,
  isTransitioning,
};
```

**Step 3: Run tests**

Run: `pnpm test`
Expected: PASS (no breaking changes, only additions)

**Step 4: Commit**

```bash
git add packages/client/src/composables/colorUtils.ts packages/client/src/composables/useColorExtraction.ts
git commit -m "feat(client): expose color palette from useColorExtraction"
```

---

## Task 4: Create Noise Texture SVG Asset

**Files:**
- Create: `packages/client/src/assets/noise.svg`

**Step 1: Create the noise texture**

Create `packages/client/src/assets/noise.svg`:

```svg
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <filter id="noise">
    <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
  </filter>
  <rect width="100%" height="100%" filter="url(#noise)" opacity="1"/>
</svg>
```

**Step 2: Commit**

```bash
git add packages/client/src/assets/noise.svg
git commit -m "feat(client): add noise texture SVG for textured backgrounds"
```

---

## Task 5: Create DynamicBackground Component

**Files:**
- Create: `packages/client/src/components/DynamicBackground.vue`

**Step 1: Create the component**

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { BackgroundType } from '@roon-screen-cover/shared';
import type { ExtractedPalette } from '../composables/colorUtils';
import type { VibrantGradient } from '../composables/useColorExtraction';

const props = defineProps<{
  type: BackgroundType;
  artworkUrl: string | null;
  palette: ExtractedPalette;
  vibrantGradient: VibrantGradient;
}>();

// Track artwork for blur/duotone backgrounds
const displayedArtwork = ref<string | null>(null);
const previousArtwork = ref<string | null>(null);
const isTransitioning = ref(false);

watch(
  () => props.artworkUrl,
  (newUrl, oldUrl) => {
    if (newUrl !== oldUrl) {
      previousArtwork.value = displayedArtwork.value;
      displayedArtwork.value = newUrl;
      isTransitioning.value = true;
      setTimeout(() => {
        isTransitioning.value = false;
        previousArtwork.value = null;
      }, 500);
    }
  },
  { immediate: true }
);

// Check if this background type needs artwork image
const needsArtwork = computed(() => {
  return ['blur-subtle', 'blur-heavy', 'duotone', 'posterized', 'blur-grain'].includes(props.type);
});

// Check if this background type needs noise overlay
const needsNoise = computed(() => {
  return ['gradient-noise', 'blur-grain'].includes(props.type);
});

// Generate mesh gradient CSS
const meshGradientStyle = computed(() => {
  const colors = props.palette.paletteCSS;
  if (colors.length < 2) {
    return 'radial-gradient(circle at 50% 50%, #1a1a1a 0%, #000 100%)';
  }

  // Create overlapping radial gradients at different positions
  const positions = [
    { x: 20, y: 30 },
    { x: 80, y: 20 },
    { x: 60, y: 70 },
    { x: 30, y: 80 },
    { x: 50, y: 50 },
  ];

  const gradients = colors.slice(0, 5).map((color, i) => {
    const pos = positions[i] || { x: 50, y: 50 };
    const size = 60 + i * 10;
    return `radial-gradient(ellipse ${size}% ${size}% at ${pos.x}% ${pos.y}%, ${color} 0%, transparent 70%)`;
  });

  return gradients.join(', ');
});

// Background style for gradient-based types
const backgroundStyle = computed(() => {
  const vg = props.vibrantGradient;
  const p = props.palette;

  switch (props.type) {
    case 'gradient-linear-multi': {
      const colors = p.paletteCSS;
      if (colors.length < 2) return { background: `linear-gradient(to bottom, ${vg.center}, ${vg.edge})` };
      const stops = colors.map((c, i) => `${c} ${(i / (colors.length - 1)) * 100}%`).join(', ');
      return { background: `linear-gradient(to bottom, ${stops})` };
    }

    case 'gradient-radial-corner':
      return { background: `radial-gradient(ellipse 150% 150% at 0% 0%, ${vg.center} 0%, ${vg.edge} 100%)` };

    case 'gradient-mesh':
      return {
        background: `${meshGradientStyle.value}, linear-gradient(to bottom, ${vg.edge}, ${vg.edge})`
      };

    case 'gradient-noise':
      return { background: `linear-gradient(to bottom, ${vg.center}, ${vg.edge})` };

    default:
      return {};
  }
});

// Image filter for artwork-based backgrounds
const imageFilter = computed(() => {
  switch (props.type) {
    case 'blur-subtle':
      return 'blur(20px)';
    case 'blur-heavy':
    case 'blur-grain':
      return 'blur(60px)';
    case 'posterized':
      return 'contrast(1.5) saturate(1.2)';
    case 'duotone':
      return 'grayscale(1) contrast(1.1)';
    default:
      return 'none';
  }
});

// Duotone overlay colors
const duotoneColors = computed(() => {
  const colors = props.palette.paletteCSS;
  return {
    dark: colors[0] || '#000',
    light: colors[1] || colors[0] || '#fff',
  };
});
</script>

<template>
  <div class="dynamic-background" :class="[type, { transitioning: isTransitioning }]">
    <!-- Gradient backgrounds -->
    <div
      v-if="!needsArtwork"
      class="gradient-layer"
      :style="backgroundStyle"
    />

    <!-- Artwork-based backgrounds -->
    <template v-if="needsArtwork && displayedArtwork">
      <!-- Previous artwork for crossfade -->
      <img
        v-if="previousArtwork && isTransitioning"
        :src="previousArtwork"
        class="artwork-bg artwork-previous"
        :style="{ filter: imageFilter }"
        alt=""
      />
      <!-- Current artwork -->
      <img
        :src="displayedArtwork"
        class="artwork-bg"
        :class="{ entering: isTransitioning }"
        :style="{ filter: imageFilter }"
        alt=""
      />

      <!-- Duotone overlay -->
      <div
        v-if="type === 'duotone'"
        class="duotone-overlay"
        :style="{
          background: `linear-gradient(to bottom, ${duotoneColors.dark}, ${duotoneColors.light})`,
        }"
      />
    </template>

    <!-- Noise overlay -->
    <div v-if="needsNoise" class="noise-overlay" />

    <!-- Content slot -->
    <div class="content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.dynamic-background {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.gradient-layer {
  position: absolute;
  inset: 0;
  transition: background 0.5s ease-out;
}

.artwork-bg {
  position: absolute;
  inset: -10%;
  width: 120%;
  height: 120%;
  object-fit: cover;
  transition: opacity 0.5s ease-out;
}

.artwork-bg.artwork-previous {
  z-index: 1;
  animation: fadeOut 0.5s ease-out forwards;
}

.artwork-bg.entering {
  animation: fadeIn 0.5s ease-out;
}

@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.duotone-overlay {
  position: absolute;
  inset: 0;
  mix-blend-mode: color;
  opacity: 0.85;
}

.noise-overlay {
  position: absolute;
  inset: 0;
  background-image: url('../assets/noise.svg');
  background-repeat: repeat;
  background-size: 200px 200px;
  opacity: 0.08;
  pointer-events: none;
}

.content {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
}
</style>
```

**Step 2: Commit**

```bash
git add packages/client/src/components/DynamicBackground.vue
git commit -m "feat(client): add DynamicBackground component for new background types"
```

---

## Task 6: Extend useBackgroundStyle for New Types

**Files:**
- Modify: `packages/client/src/composables/useBackgroundStyle.ts`

**Step 1: Update needsColorExtraction**

```typescript
const needsColorExtraction = computed(() => {
  return [
    'dominant',
    'gradient-radial',
    'gradient-linear',
    'gradient-linear-multi',
    'gradient-radial-corner',
    'gradient-mesh',
    'blur-subtle',
    'blur-heavy',
    'duotone',
    'posterized',
    'gradient-noise',
    'blur-grain',
  ].includes(backgroundType.value);
});
```

**Step 2: Add new cases to the switch statement**

Add after the `gradient-linear` case:

```typescript
case 'gradient-linear-multi':
case 'gradient-radial-corner':
case 'gradient-mesh':
case 'gradient-noise':
  // These are handled by DynamicBackground component
  // Just provide text color variables based on mode
  if (vibrantGradient?.value?.ready) {
    const isDark = vibrantGradient.value.mode === 'dark';
    return {
      '--text-color': vibrantGradient.value.text,
      '--text-secondary': vibrantGradient.value.textSecondary,
      '--text-tertiary': vibrantGradient.value.textTertiary,
      '--progress-bar-bg': isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(26, 26, 26, 0.15)',
      '--progress-bar-fill': isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(26, 26, 26, 0.7)',
    };
  }
  return {
    '--text-color': '#ffffff',
    '--text-secondary': 'rgba(255, 255, 255, 0.8)',
    '--text-tertiary': 'rgba(255, 255, 255, 0.6)',
    '--progress-bar-bg': 'rgba(255, 255, 255, 0.2)',
    '--progress-bar-fill': 'rgba(255, 255, 255, 0.9)',
  };

case 'blur-subtle':
case 'blur-heavy':
case 'blur-grain':
case 'duotone':
case 'posterized':
  // Artwork-based backgrounds - use dark text variables
  // since blurred artwork tends to be lighter
  if (colors?.value?.ready) {
    const isDark = colors.value.mode === 'dark';
    return {
      '--text-color': colors.value.text,
      '--text-secondary': colors.value.textSecondary,
      '--text-tertiary': colors.value.textTertiary,
      '--progress-bar-bg': isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(26, 26, 26, 0.15)',
      '--progress-bar-fill': isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(26, 26, 26, 0.7)',
    };
  }
  return {
    '--text-color': '#ffffff',
    '--text-secondary': 'rgba(255, 255, 255, 0.8)',
    '--text-tertiary': 'rgba(255, 255, 255, 0.6)',
    '--progress-bar-bg': 'rgba(255, 255, 255, 0.2)',
    '--progress-bar-fill': 'rgba(255, 255, 255, 0.9)',
  };
```

**Step 3: Run tests**

Run: `pnpm test`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/client/src/composables/useBackgroundStyle.ts
git commit -m "feat(client): extend useBackgroundStyle for new background types"
```

---

## Task 7: Update Admin UI with Grouped Background Dropdown

**Files:**
- Modify: `packages/client/src/views/AdminView.vue`

**Step 1: Import BACKGROUND_CONFIG**

Already imported, just need to use the category field.

**Step 2: Replace background select with optgroups**

Find the background `<select>` element (around line 221-235) and replace with:

```vue
<td>
  <select
    :value="client.background"
    :disabled="pushing[client.clientId]"
    @change="
      (e) =>
        pushSetting(client.clientId, {
          background: (e.target as HTMLSelectElement).value as BackgroundType,
        })
    "
  >
    <optgroup label="Basic">
      <option v-for="b in BACKGROUNDS.filter(bg => BACKGROUND_CONFIG[bg].category === 'basic')" :key="b" :value="b">
        {{ getBackgroundDisplayName(b) }}
      </option>
    </optgroup>
    <optgroup label="Gradients">
      <option v-for="b in BACKGROUNDS.filter(bg => BACKGROUND_CONFIG[bg].category === 'gradient')" :key="b" :value="b">
        {{ getBackgroundDisplayName(b) }}
      </option>
    </optgroup>
    <optgroup label="Artwork">
      <option v-for="b in BACKGROUNDS.filter(bg => BACKGROUND_CONFIG[bg].category === 'artwork')" :key="b" :value="b">
        {{ getBackgroundDisplayName(b) }}
      </option>
    </optgroup>
    <optgroup label="Textured">
      <option v-for="b in BACKGROUNDS.filter(bg => BACKGROUND_CONFIG[bg].category === 'textured')" :key="b" :value="b">
        {{ getBackgroundDisplayName(b) }}
      </option>
    </optgroup>
  </select>
</td>
```

**Step 3: Run type check**

Run: `pnpm typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add packages/client/src/views/AdminView.vue
git commit -m "feat(client): add grouped background dropdown in Admin UI"
```

---

## Task 8: Update AmbientLayout to Use DynamicBackground

**Files:**
- Modify: `packages/client/src/layouts/AmbientLayout.vue`

**Step 1: Import DynamicBackground and update template**

Update imports:

```typescript
import DynamicBackground from '../components/DynamicBackground.vue';
import type { ExtractedPalette } from '../composables/colorUtils';
```

Update the return from useColorExtraction:

```typescript
const { colors, vibrantGradient, palette, isTransitioning } = useColorExtraction(artworkUrlRef);
```

**Step 2: Update template to wrap content with DynamicBackground**

Replace the outer div with:

```vue
<template>
  <DynamicBackground
    :type="background"
    :artwork-url="artworkUrl"
    :palette="palette"
    :vibrant-gradient="vibrantGradient"
    class="ambient-layout"
    :class="{ transitioning: isTransitioning }"
    :style="ambientStyle"
  >
    <div class="safe-zone">
      <!-- rest of content unchanged -->
    </div>
  </DynamicBackground>
</template>
```

**Step 3: Update ambientStyle to not duplicate background for new types**

```typescript
const ambientStyle = computed(() => {
  // For new background types, DynamicBackground handles the background
  const newTypes = ['gradient-linear-multi', 'gradient-radial-corner', 'gradient-mesh',
    'blur-subtle', 'blur-heavy', 'duotone', 'posterized', 'gradient-noise', 'blur-grain'];

  if (newTypes.includes(props.background)) {
    return {
      '--bg-color': colors.value.background,
      '--bg-edge': colors.value.backgroundEdge,
      '--shadow-color': colors.value.shadow,
      '--progress-bar-height': '6px',
      '--progress-time-size': 'clamp(14px, 1.5vw, 18px)',
      '--progress-bar-bg': effectiveColorMode.value === 'dark'
        ? 'rgba(255, 255, 255, 0.15)'
        : 'rgba(0, 0, 0, 0.15)',
      '--progress-bar-fill': effectiveColorMode.value === 'dark'
        ? 'rgba(255, 255, 255, 0.8)'
        : 'rgba(0, 0, 0, 0.6)',
    };
  }

  // Original logic for existing types
  const baseStyle = { ...backgroundStyle.value };
  // ... rest of existing logic
});
```

**Step 4: Run dev server and test visually**

Run: `pnpm dev`
Test: Change background types in Admin UI, verify they display correctly

**Step 5: Commit**

```bash
git add packages/client/src/layouts/AmbientLayout.vue
git commit -m "feat(client): integrate DynamicBackground into AmbientLayout"
```

---

## Task 9: Update Remaining Layouts

**Files:**
- Modify: `packages/client/src/layouts/DetailedLayout.vue`
- Modify: `packages/client/src/layouts/MinimalLayout.vue`
- Modify: `packages/client/src/layouts/CoverLayout.vue`
- Modify: `packages/client/src/layouts/FullscreenLayout.vue`

**Step 1: Read each layout file**

Check current structure and background handling.

**Step 2: Integrate DynamicBackground into each layout**

Follow the same pattern as AmbientLayout:
1. Import DynamicBackground
2. Get palette from useColorExtraction
3. Wrap content with DynamicBackground component
4. Pass required props

**Step 3: Test each layout**

Run: `pnpm dev`
Test: Switch between layouts with different background types

**Step 4: Commit**

```bash
git add packages/client/src/layouts/*.vue
git commit -m "feat(client): integrate DynamicBackground into all layouts"
```

---

## Task 10: Update usePreferences to Handle New Background Types

**Files:**
- Modify: `packages/client/src/composables/usePreferences.ts`
- Test: `packages/client/src/composables/usePreferences.spec.ts`

**Step 1: Verify usePreferences already uses BACKGROUNDS array**

Check if validation uses the BACKGROUNDS constant from shared package.

**Step 2: Add test for new background types**

```typescript
it('should accept new background types from URL', () => {
  mockSearchParams.set('background', 'gradient-mesh');

  const { background } = usePreferences();
  expect(background.value).toBe('gradient-mesh');
});

it('should accept blur-subtle background', () => {
  mockSearchParams.set('background', 'blur-subtle');

  const { background } = usePreferences();
  expect(background.value).toBe('blur-subtle');
});
```

**Step 3: Run tests**

Run: `pnpm test -- packages/client/src/composables/usePreferences.spec.ts`
Expected: PASS (if using BACKGROUNDS constant) or FAIL (if hardcoded)

**Step 4: Fix if needed and commit**

```bash
git add packages/client/src/composables/usePreferences.ts packages/client/src/composables/usePreferences.spec.ts
git commit -m "test(client): verify usePreferences handles new background types"
```

---

## Task 11: Run Full Validation

**Files:** None (validation only)

**Step 1: Run type check**

Run: `pnpm typecheck`
Expected: No errors

**Step 2: Run linter**

Run: `pnpm lint`
Expected: No errors (or fix any that appear)

**Step 3: Run all tests**

Run: `pnpm test`
Expected: All tests pass

**Step 4: Run dev server and manual test**

Run: `pnpm dev`
Test checklist:
- [ ] All 14 background types appear in Admin dropdown
- [ ] Grouped into Basic, Gradients, Artwork, Textured
- [ ] gradient-linear-multi shows multi-color vertical gradient
- [ ] gradient-radial-corner shows gradient from corner
- [ ] gradient-mesh shows organic multi-color blend
- [ ] blur-subtle shows lightly blurred artwork
- [ ] blur-heavy shows heavily blurred artwork
- [ ] duotone shows two-color overlay on artwork
- [ ] posterized shows high-contrast artwork
- [ ] gradient-noise shows gradient with noise overlay
- [ ] blur-grain shows blur with film grain
- [ ] Transitions work when changing tracks
- [ ] Text remains readable on all backgrounds

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: address validation issues"
```

---

## Task 12: Final Commit and Branch Summary

**Step 1: Check git status**

Run: `git status`
Expected: Clean working tree

**Step 2: Push branch**

Run: `git push -u origin feature/background-types`

**Step 3: Summary**

Created feature branch with:
- 11 new background types (14 total)
- Extended color extraction for 5-color palette
- DynamicBackground component for artwork/gradient effects
- Grouped Admin UI dropdown
- Full layout integration
- All tests passing
