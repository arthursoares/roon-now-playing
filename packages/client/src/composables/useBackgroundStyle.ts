import { computed, type Ref, type ComputedRef } from 'vue';
import type { BackgroundType } from '@roon-screen-cover/shared';
import type { ExtractedColors } from './colorUtils';
import type { VibrantGradient } from './useColorExtraction';

export interface BackgroundStyleResult {
  style: ComputedRef<Record<string, string>>;
  needsColorExtraction: ComputedRef<boolean>;
}

/**
 * Composable for generating background styles based on background type
 * @param backgroundType - The selected background type
 * @param colors - Optional extracted colors from artwork (for dominant background)
 * @param vibrantGradient - Optional vibrant gradient colors (for gradient backgrounds)
 */
export function useBackgroundStyle(
  backgroundType: Ref<BackgroundType>,
  colors?: Ref<ExtractedColors>,
  vibrantGradient?: Ref<VibrantGradient>
): BackgroundStyleResult {
  const needsColorExtraction = computed(() => {
    return ['dominant', 'gradient-radial', 'gradient-linear'].includes(backgroundType.value);
  });

  const style = computed(() => {
    switch (backgroundType.value) {
      case 'black':
        return {
          background: '#000000',
          '--text-color': '#ffffff',
          '--text-secondary': 'rgba(255, 255, 255, 0.8)',
          '--text-tertiary': 'rgba(255, 255, 255, 0.6)',
          '--progress-bar-bg': 'rgba(255, 255, 255, 0.2)',
          '--progress-bar-fill': 'rgba(255, 255, 255, 0.9)',
        };

      case 'white':
        return {
          background: '#ffffff',
          '--text-color': '#1a1a1a',
          '--text-secondary': 'rgba(26, 26, 26, 0.8)',
          '--text-tertiary': 'rgba(26, 26, 26, 0.6)',
          '--progress-bar-bg': 'rgba(26, 26, 26, 0.15)',
          '--progress-bar-fill': 'rgba(26, 26, 26, 0.7)',
        };

      case 'dominant':
        // Use vibrant colors for a more punchy dominant background
        if (vibrantGradient?.value?.ready) {
          const isDark = vibrantGradient.value.mode === 'dark';
          return {
            background: vibrantGradient.value.center,
            '--text-color': vibrantGradient.value.text,
            '--text-secondary': vibrantGradient.value.textSecondary,
            '--text-tertiary': vibrantGradient.value.textTertiary,
            '--progress-bar-bg': isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(26, 26, 26, 0.15)',
            '--progress-bar-fill': isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(26, 26, 26, 0.7)',
          };
        }
        // Fallback to black if no colors available
        return {
          background: '#000000',
          '--text-color': '#ffffff',
          '--text-secondary': 'rgba(255, 255, 255, 0.8)',
          '--text-tertiary': 'rgba(255, 255, 255, 0.6)',
          '--progress-bar-bg': 'rgba(255, 255, 255, 0.2)',
          '--progress-bar-fill': 'rgba(255, 255, 255, 0.9)',
        };

      case 'gradient-radial':
        if (vibrantGradient?.value?.ready) {
          const isDark = vibrantGradient.value.mode === 'dark';
          return {
            background: `radial-gradient(ellipse 120% 100% at 50% 50%, ${vibrantGradient.value.center} 0%, ${vibrantGradient.value.edge} 100%)`,
            '--text-color': vibrantGradient.value.text,
            '--text-secondary': vibrantGradient.value.textSecondary,
            '--text-tertiary': vibrantGradient.value.textTertiary,
            '--progress-bar-bg': isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(26, 26, 26, 0.15)',
            '--progress-bar-fill': isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(26, 26, 26, 0.7)',
          };
        }
        // Fallback gradient
        return {
          background: 'radial-gradient(ellipse 120% 100% at 50% 50%, #1a1a1a 0%, #000000 100%)',
          '--text-color': '#ffffff',
          '--text-secondary': 'rgba(255, 255, 255, 0.8)',
          '--text-tertiary': 'rgba(255, 255, 255, 0.6)',
          '--progress-bar-bg': 'rgba(255, 255, 255, 0.2)',
          '--progress-bar-fill': 'rgba(255, 255, 255, 0.9)',
        };

      case 'gradient-linear':
        if (vibrantGradient?.value?.ready) {
          const isDark = vibrantGradient.value.mode === 'dark';
          return {
            background: `linear-gradient(135deg, ${vibrantGradient.value.center} 0%, ${vibrantGradient.value.edge} 100%)`,
            '--text-color': vibrantGradient.value.text,
            '--text-secondary': vibrantGradient.value.textSecondary,
            '--text-tertiary': vibrantGradient.value.textTertiary,
            '--progress-bar-bg': isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(26, 26, 26, 0.15)',
            '--progress-bar-fill': isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(26, 26, 26, 0.7)',
          };
        }
        // Fallback gradient
        return {
          background: 'linear-gradient(135deg, #1a1a1a 0%, #000000 100%)',
          '--text-color': '#ffffff',
          '--text-secondary': 'rgba(255, 255, 255, 0.8)',
          '--text-tertiary': 'rgba(255, 255, 255, 0.6)',
          '--progress-bar-bg': 'rgba(255, 255, 255, 0.2)',
          '--progress-bar-fill': 'rgba(255, 255, 255, 0.9)',
        };

      default:
        return {
          background: '#000000',
          '--text-color': '#ffffff',
          '--text-secondary': 'rgba(255, 255, 255, 0.8)',
          '--text-tertiary': 'rgba(255, 255, 255, 0.6)',
          '--progress-bar-bg': 'rgba(255, 255, 255, 0.2)',
          '--progress-bar-fill': 'rgba(255, 255, 255, 0.9)',
        };
    }
  });

  return {
    style,
    needsColorExtraction,
  };
}
