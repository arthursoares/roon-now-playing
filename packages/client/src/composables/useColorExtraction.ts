import { ref, watch, type Ref } from 'vue';
import {
  extractDominantColor,
  generateColors,
  generateVibrantGradient,
  DEFAULT_LIGHT,
  SAMPLE_SIZE,
  type ExtractedColors,
} from './colorUtils';

export type { ExtractedColors } from './colorUtils';

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

export function useColorExtraction(artworkUrl: Ref<string | null>) {
  const colors = ref<ExtractedColors>({ ...DEFAULT_LIGHT });
  const vibrantGradient = ref<VibrantGradient>({ ...DEFAULT_VIBRANT });
  const previousColors = ref<ExtractedColors | null>(null);
  const isTransitioning = ref(false);

  let currentImageUrl: string | null = null;

  async function extractColors(url: string): Promise<{ colors: ExtractedColors; vibrant: VibrantGradient }> {
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
            });
            return;
          }

          ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
          const imageData = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
          const dominant = extractDominantColor(imageData);
          const extracted = generateColors(dominant);
          const vibrant = generateVibrantGradient(dominant);

          resolve({
            colors: extracted,
            vibrant: { ...vibrant, ready: true },
          });
        } catch (error) {
          console.warn('Color extraction failed:', error);
          resolve({
            colors: { ...DEFAULT_LIGHT, ready: true },
            vibrant: { ...DEFAULT_VIBRANT, ready: true },
          });
        }
      };

      img.onerror = () => {
        console.warn('Failed to load image for color extraction');
        resolve({
          colors: { ...DEFAULT_LIGHT, ready: true },
          vibrant: { ...DEFAULT_VIBRANT, ready: true },
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
    previousColors,
    isTransitioning,
  };
}
