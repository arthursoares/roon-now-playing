import { ref, watch, type Ref } from 'vue';
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

export type { ExtractedColors, ExtractedPalette, HSL } from './colorUtils';

export interface VibrantGradient {
  center: string;
  edge: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  mode: 'light' | 'dark';
  ready: boolean;
}

const DEFAULT_VIBRANT: VibrantGradient = {
  center: 'hsl(220, 50%, 30%)',
  edge: 'hsl(220, 60%, 10%)',
  text: '#f5f5f5',
  textSecondary: 'rgba(245, 245, 245, 0.85)',
  textTertiary: 'rgba(245, 245, 245, 0.7)',
  mode: 'dark',
  ready: false,
};

const DEFAULT_PALETTE: ExtractedPalette = {
  dominant: { h: 220, s: 20, l: 50 },
  palette: [],
  paletteCSS: [],
  isDark: true,
};

export function useColorExtraction(artworkUrl: Ref<string | null>) {
  const colors = ref<ExtractedColors>({ ...DEFAULT_LIGHT });
  const vibrantGradient = ref<VibrantGradient>({ ...DEFAULT_VIBRANT });
  const palette = ref<ExtractedPalette>({ ...DEFAULT_PALETTE });
  const previousColors = ref<ExtractedColors | null>(null);
  const isTransitioning = ref(false);

  let currentImageUrl: string | null = null;

  async function extractColors(url: string): Promise<{ colors: ExtractedColors; vibrant: VibrantGradient; palette: ExtractedPalette }> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = SAMPLE_SIZE;
          canvas.height = SAMPLE_SIZE;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({
              colors: { ...DEFAULT_LIGHT, ready: true },
              vibrant: { ...DEFAULT_VIBRANT, ready: true },
              palette: { ...DEFAULT_PALETTE },
            });
            return;
          }

          ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
          const imageData = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
          const dominant = extractDominantColor(imageData);
          const extracted = generateColors(dominant);
          const vibrant = generateVibrantGradient(dominant);

          // Extract color palette
          const paletteColors = extractColorPalette(imageData);
          const paletteCSS = paletteColors.map((c) => hslToString(c.h, c.s, c.l));
          const extractedPalette: ExtractedPalette = {
            dominant,
            palette: paletteColors,
            paletteCSS,
            isDark: dominant.l <= 50,
          };

          resolve({
            colors: extracted,
            vibrant: { ...vibrant, ready: true },
            palette: extractedPalette,
          });
        } catch (error) {
          console.warn('Color extraction failed:', error);
          resolve({
            colors: { ...DEFAULT_LIGHT, ready: true },
            vibrant: { ...DEFAULT_VIBRANT, ready: true },
            palette: { ...DEFAULT_PALETTE },
          });
        }
      };

      img.onerror = () => {
        console.warn('Failed to load image for color extraction');
        resolve({
          colors: { ...DEFAULT_LIGHT, ready: true },
          vibrant: { ...DEFAULT_VIBRANT, ready: true },
          palette: { ...DEFAULT_PALETTE },
        });
      };

      img.src = url;
    });
  }

  // Watch for artwork URL changes
  watch(
    artworkUrl,
    async (newUrl) => {
      if (newUrl === currentImageUrl) return;
      currentImageUrl = newUrl;

      if (!newUrl) {
        // No artwork - use default
        previousColors.value = colors.value.ready ? { ...colors.value } : null;
        colors.value = { ...DEFAULT_LIGHT };
        vibrantGradient.value = { ...DEFAULT_VIBRANT };
        palette.value = { ...DEFAULT_PALETTE };
        return;
      }

      // Store previous colors for transition
      if (colors.value.ready) {
        previousColors.value = { ...colors.value };
      }

      isTransitioning.value = true;

      const extracted = await extractColors(newUrl);
      colors.value = extracted.colors;
      vibrantGradient.value = extracted.vibrant;
      palette.value = extracted.palette;

      // Clear transition state after animation duration
      setTimeout(() => {
        isTransitioning.value = false;
        previousColors.value = null;
      }, 500);
    },
    { immediate: true }
  );

  return {
    colors,
    vibrantGradient,
    palette,
    previousColors,
    isTransitioning,
  };
}
