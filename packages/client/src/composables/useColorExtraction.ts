import { ref, watch, type Ref } from 'vue';
import {
  extractDominantColor,
  generateColors,
  DEFAULT_LIGHT,
  SAMPLE_SIZE,
  type ExtractedColors,
} from './colorUtils';

export type { ExtractedColors } from './colorUtils';

export function useColorExtraction(artworkUrl: Ref<string | null>) {
  const colors = ref<ExtractedColors>({ ...DEFAULT_LIGHT });
  const previousColors = ref<ExtractedColors | null>(null);
  const isTransitioning = ref(false);

  let currentImageUrl: string | null = null;

  async function extractColors(url: string): Promise<ExtractedColors> {
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
            resolve({ ...DEFAULT_LIGHT, ready: true });
            return;
          }

          ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
          const imageData = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
          const dominant = extractDominantColor(imageData);
          const extracted = generateColors(dominant);

          resolve(extracted);
        } catch (error) {
          console.warn('Color extraction failed:', error);
          resolve({ ...DEFAULT_LIGHT, ready: true });
        }
      };

      img.onerror = () => {
        console.warn('Failed to load image for color extraction');
        resolve({ ...DEFAULT_LIGHT, ready: true });
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
        return;
      }

      // Store previous colors for transition
      if (colors.value.ready) {
        previousColors.value = { ...colors.value };
      }

      isTransitioning.value = true;

      const extracted = await extractColors(newUrl);
      colors.value = extracted;

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
    previousColors,
    isTransitioning,
  };
}
