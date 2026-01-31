<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { BackgroundType } from '@roon-screen-cover/shared';
import type { ExtractedPalette, VibrantGradient } from '../composables/useColorExtraction';
import noiseUrl from '../assets/noise.svg';

const props = defineProps<{
  type: BackgroundType;
  artworkUrl: string | null;
  palette: ExtractedPalette;
  vibrantGradient: VibrantGradient;
}>();

// Track artwork changes for crossfade transitions
const currentArtwork = ref<string | null>(null);
const previousArtwork = ref<string | null>(null);
const isTransitioning = ref(false);

watch(
  () => props.artworkUrl,
  (newUrl, oldUrl) => {
    if (newUrl !== oldUrl) {
      previousArtwork.value = currentArtwork.value;
      currentArtwork.value = newUrl;
      isTransitioning.value = true;

      // Clear transition state after animation duration (500ms)
      setTimeout(() => {
        isTransitioning.value = false;
        previousArtwork.value = null;
      }, 500);
    }
  },
  { immediate: true }
);

// Background types that require artwork image
const needsArtwork = computed(() => {
  return ['blur-subtle', 'blur-heavy', 'duotone', 'posterized', 'blur-grain'].includes(props.type);
});

// Background types that require noise overlay
const needsNoise = computed(() => {
  return ['gradient-noise', 'blur-grain'].includes(props.type);
});

// Mesh gradient style using overlapping radial gradients from palette colors
const meshGradientStyle = computed(() => {
  const colors = props.palette.paletteCSS;
  if (colors.length < 2) {
    // Fallback if not enough colors
    return {
      background: props.vibrantGradient.center,
    };
  }

  // Create overlapping radial gradients at different positions
  const gradients: string[] = [];
  const positions = [
    { x: '0%', y: '0%' },
    { x: '100%', y: '0%' },
    { x: '100%', y: '100%' },
    { x: '0%', y: '100%' },
    { x: '50%', y: '50%' },
  ];

  colors.slice(0, 5).forEach((color, index) => {
    const pos = positions[index % positions.length];
    gradients.push(`radial-gradient(ellipse at ${pos.x} ${pos.y}, ${color} 0%, transparent 70%)`);
  });

  return {
    background: gradients.join(', '),
    backgroundColor: colors[0] || props.vibrantGradient.edge,
  };
});

// Background style for gradient types
const backgroundStyle = computed(() => {
  const colors = props.palette.paletteCSS;
  const { center, edge } = props.vibrantGradient;

  switch (props.type) {
    case 'gradient-linear-multi': {
      if (colors.length < 2) {
        return { background: `linear-gradient(135deg, ${center}, ${edge})` };
      }
      const colorStops = colors.map((c, i) => `${c} ${(i / (colors.length - 1)) * 100}%`).join(', ');
      return { background: `linear-gradient(135deg, ${colorStops})` };
    }

    case 'gradient-radial-corner': {
      return {
        background: `radial-gradient(ellipse at 0% 0%, ${center} 0%, ${edge} 100%)`,
      };
    }

    case 'gradient-mesh':
      return meshGradientStyle.value;

    case 'gradient-noise': {
      if (colors.length < 2) {
        return { background: `linear-gradient(135deg, ${center}, ${edge})` };
      }
      const colorStops = colors.map((c, i) => `${c} ${(i / (colors.length - 1)) * 100}%`).join(', ');
      return { background: `linear-gradient(135deg, ${colorStops})` };
    }

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
      return 'contrast(1.4) saturate(1.3)';
    case 'duotone':
      return 'grayscale(1) contrast(1.2)';
    default:
      return 'none';
  }
});

// Duotone overlay colors (first two palette colors)
const duotoneColors = computed(() => {
  const colors = props.palette.paletteCSS;
  if (colors.length >= 2) {
    return {
      primary: colors[0],
      secondary: colors[1],
    };
  }
  // Fallback
  return {
    primary: props.vibrantGradient.center,
    secondary: props.vibrantGradient.edge,
  };
});

const duotoneGradient = computed(() => {
  return `linear-gradient(135deg, ${duotoneColors.value.primary}, ${duotoneColors.value.secondary})`;
});
</script>

<template>
  <div class="dynamic-background">
    <!-- Gradient layer (for gradient-based backgrounds) -->
    <div
      v-if="!needsArtwork"
      class="gradient-layer"
      :style="backgroundStyle"
    />

    <!-- Artwork background layers (for artwork-based backgrounds) -->
    <template v-if="needsArtwork">
      <!-- Previous artwork (fading out) -->
      <img
        v-if="previousArtwork && isTransitioning"
        :src="previousArtwork"
        class="artwork-bg fade-out"
        :style="{ filter: imageFilter }"
        alt=""
      />
      <!-- Current artwork (fading in) -->
      <img
        v-if="currentArtwork"
        :src="currentArtwork"
        class="artwork-bg"
        :class="{ 'fade-in': isTransitioning }"
        :style="{ filter: imageFilter }"
        alt=""
      />
    </template>

    <!-- Duotone overlay -->
    <div
      v-if="type === 'duotone'"
      class="duotone-overlay"
      :style="{ background: duotoneGradient }"
    />

    <!-- Noise overlay -->
    <div
      v-if="needsNoise"
      class="noise-overlay"
      :style="{ backgroundImage: `url(${noiseUrl})` }"
    />

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
  transition: background 0.5s ease;
}

.artwork-bg {
  position: absolute;
  inset: -10%;
  width: 120%;
  height: 120%;
  object-fit: cover;
}

.artwork-bg.fade-in {
  animation: fadeIn 0.5s ease forwards;
}

.artwork-bg.fade-out {
  animation: fadeOut 0.5s ease forwards;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes fadeOut {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
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
