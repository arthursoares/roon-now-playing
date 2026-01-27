import { computed, type Ref, type ComputedRef } from 'vue';
import type { BackgroundType } from '@roon-screen-cover/shared';
import type { ExtractedColors } from './colorUtils';

export interface BackgroundStyleResult {
  style: ComputedRef<Record<string, string>>;
  needsColorExtraction: ComputedRef<boolean>;
}

/**
 * Composable for generating background styles based on background type
 * @param backgroundType - The selected background type
 * @param colors - Optional extracted colors from artwork (required for dominant/gradient types)
 */
export function useBackgroundStyle(
  backgroundType: Ref<BackgroundType>,
  colors?: Ref<ExtractedColors>
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
        };

      case 'white':
        return {
          background: '#ffffff',
          '--text-color': '#1a1a1a',
          '--text-secondary': 'rgba(26, 26, 26, 0.8)',
          '--text-tertiary': 'rgba(26, 26, 26, 0.6)',
        };

      case 'dominant':
        if (colors?.value) {
          return {
            background: colors.value.background,
            '--text-color': colors.value.text,
            '--text-secondary': colors.value.textSecondary,
            '--text-tertiary': colors.value.textTertiary,
          };
        }
        // Fallback to black if no colors available
        return {
          background: '#000000',
          '--text-color': '#ffffff',
          '--text-secondary': 'rgba(255, 255, 255, 0.8)',
          '--text-tertiary': 'rgba(255, 255, 255, 0.6)',
        };

      case 'gradient-radial':
        if (colors?.value) {
          return {
            background: `radial-gradient(ellipse 120% 100% at 50% 50%, ${colors.value.background} 0%, ${colors.value.backgroundEdge} 100%)`,
            '--text-color': colors.value.text,
            '--text-secondary': colors.value.textSecondary,
            '--text-tertiary': colors.value.textTertiary,
          };
        }
        // Fallback gradient
        return {
          background: 'radial-gradient(ellipse 120% 100% at 50% 50%, #1a1a1a 0%, #000000 100%)',
          '--text-color': '#ffffff',
          '--text-secondary': 'rgba(255, 255, 255, 0.8)',
          '--text-tertiary': 'rgba(255, 255, 255, 0.6)',
        };

      case 'gradient-linear':
        if (colors?.value) {
          return {
            background: `linear-gradient(135deg, ${colors.value.background} 0%, ${colors.value.backgroundEdge} 100%)`,
            '--text-color': colors.value.text,
            '--text-secondary': colors.value.textSecondary,
            '--text-tertiary': colors.value.textTertiary,
          };
        }
        // Fallback gradient
        return {
          background: 'linear-gradient(135deg, #1a1a1a 0%, #000000 100%)',
          '--text-color': '#ffffff',
          '--text-secondary': 'rgba(255, 255, 255, 0.8)',
          '--text-tertiary': 'rgba(255, 255, 255, 0.6)',
        };

      default:
        return {
          background: '#000000',
          '--text-color': '#ffffff',
          '--text-secondary': 'rgba(255, 255, 255, 0.8)',
          '--text-tertiary': 'rgba(255, 255, 255, 0.6)',
        };
    }
  });

  return {
    style,
    needsColorExtraction,
  };
}
