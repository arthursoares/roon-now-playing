import { ref, watch, type Ref } from 'vue';

export interface ExtractedColors {
  /** Background color in CSS format */
  background: string;
  /** Gradient edge color (darker/more saturated) */
  backgroundEdge: string;
  /** Shadow color for artwork */
  shadow: string;
  /** Text color (black or white based on luminance) */
  text: string;
  /** Secondary text color (slightly transparent) */
  textSecondary: string;
  /** Tertiary text color (more transparent) */
  textTertiary: string;
  /** Whether the scheme is light or dark */
  mode: 'light' | 'dark';
  /** Whether colors are ready */
  ready: boolean;
}

interface HSL {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

const DEFAULT_LIGHT: ExtractedColors = {
  background: 'hsl(30, 20%, 88%)',
  backgroundEdge: 'hsl(30, 25%, 75%)',
  shadow: 'hsla(30, 30%, 40%, 0.25)',
  text: '#1a1a1a',
  textSecondary: 'rgba(26, 26, 26, 0.8)',
  textTertiary: 'rgba(26, 26, 26, 0.6)',
  mode: 'light',
  ready: false,
};

const DEFAULT_DARK: ExtractedColors = {
  background: 'hsl(220, 15%, 15%)',
  backgroundEdge: 'hsl(220, 20%, 8%)',
  shadow: 'hsla(220, 20%, 5%, 0.4)',
  text: '#f5f5f5',
  textSecondary: 'rgba(245, 245, 245, 0.8)',
  textTertiary: 'rgba(245, 245, 245, 0.6)',
  mode: 'dark',
  ready: false,
};

// Color extraction parameters
const SAMPLE_SIZE = 50; // Canvas size for sampling
const HUE_BUCKETS = 12; // Number of hue groups
const LOW_SATURATION_THRESHOLD = 15; // Below this = grayscale

// Lightness bounds
const LIGHT_MODE_MIN_L = 80;
const LIGHT_MODE_MAX_L = 92;
const LIGHT_MODE_TARGET_L = 87;
const LIGHT_MODE_TARGET_S = 25;

const DARK_MODE_MIN_L = 12;
const DARK_MODE_MAX_L = 22;
const DARK_MODE_TARGET_L = 17;
const DARK_MODE_TARGET_S = 35;

export function useColorExtraction(artworkUrl: Ref<string | null>) {
  const colors = ref<ExtractedColors>({ ...DEFAULT_LIGHT });
  const previousColors = ref<ExtractedColors | null>(null);
  const isTransitioning = ref(false);

  let currentImageUrl: string | null = null;

  function rgbToHsl(r: number, g: number, b: number): HSL {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  }

  function hslToString(h: number, s: number, l: number, a?: number): string {
    if (a !== undefined) {
      return `hsla(${h}, ${s}%, ${l}%, ${a})`;
    }
    return `hsl(${h}, ${s}%, ${l}%)`;
  }

  function getLuminance(r: number, g: number, b: number): number {
    // Relative luminance formula
    const rsRGB = r / 255;
    const gsRGB = g / 255;
    const bsRGB = b / 255;

    const rL = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
    const gL = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
    const bL = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

    return 0.2126 * rL + 0.7152 * gL + 0.0722 * bL;
  }

  function hslToRgb(h: number, s: number, l: number): RGB {
    h /= 360;
    s /= 100;
    l /= 100;

    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
    };
  }

  function extractDominantColor(imageData: ImageData): HSL {
    const pixels = imageData.data;
    const hueBuckets: { colors: HSL[]; count: number }[] = Array.from(
      { length: HUE_BUCKETS },
      () => ({ colors: [], count: 0 })
    );

    // Also track overall saturation to detect grayscale images
    let totalSaturation = 0;
    let pixelCount = 0;

    // Sample pixels and group by hue
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3];

      // Skip transparent pixels
      if (a < 128) continue;

      const hsl = rgbToHsl(r, g, b);
      totalSaturation += hsl.s;
      pixelCount++;

      // Weight by saturation - more saturated colors are more "dominant"
      const weight = Math.max(1, hsl.s / 20);
      const bucketIndex = Math.floor(hsl.h / (360 / HUE_BUCKETS)) % HUE_BUCKETS;

      for (let w = 0; w < weight; w++) {
        hueBuckets[bucketIndex].colors.push(hsl);
        hueBuckets[bucketIndex].count++;
      }
    }

    const avgSaturation = pixelCount > 0 ? totalSaturation / pixelCount : 0;

    // If image is essentially grayscale, return neutral
    if (avgSaturation < LOW_SATURATION_THRESHOLD) {
      // Determine if it's warm or cool gray based on slight hue bias
      const warmCount = hueBuckets.slice(0, 2).reduce((sum, b) => sum + b.count, 0) +
                        hueBuckets.slice(10, 12).reduce((sum, b) => sum + b.count, 0);
      const coolCount = hueBuckets.slice(5, 8).reduce((sum, b) => sum + b.count, 0);

      const hue = warmCount > coolCount ? 30 : 220;
      return { h: hue, s: 10, l: 50 };
    }

    // Find dominant bucket
    let maxBucket = hueBuckets[0];
    for (const bucket of hueBuckets) {
      if (bucket.count > maxBucket.count) {
        maxBucket = bucket;
      }
    }

    // Average colors in dominant bucket
    if (maxBucket.colors.length === 0) {
      return { h: 30, s: 20, l: 50 };
    }

    const avgH = maxBucket.colors.reduce((sum, c) => sum + c.h, 0) / maxBucket.colors.length;
    const avgS = maxBucket.colors.reduce((sum, c) => sum + c.s, 0) / maxBucket.colors.length;
    const avgL = maxBucket.colors.reduce((sum, c) => sum + c.l, 0) / maxBucket.colors.length;

    return { h: Math.round(avgH), s: Math.round(avgS), l: Math.round(avgL) };
  }

  function generateColors(dominant: HSL): ExtractedColors {
    // Determine mode based on original image lightness
    const isDarkMode = dominant.l <= 50;

    let bgH = dominant.h;
    let bgS: number;
    let bgL: number;

    if (isDarkMode) {
      // Dark mode: low lightness, moderate saturation
      bgS = Math.min(dominant.s * 0.7, DARK_MODE_TARGET_S + 15);
      bgS = Math.max(bgS, DARK_MODE_TARGET_S - 10);
      bgL = DARK_MODE_TARGET_L;
      bgL = Math.max(DARK_MODE_MIN_L, Math.min(DARK_MODE_MAX_L, bgL));
    } else {
      // Light mode: high lightness, low saturation
      bgS = Math.min(dominant.s * 0.4, LIGHT_MODE_TARGET_S + 10);
      bgS = Math.max(bgS, LIGHT_MODE_TARGET_S - 10);
      bgL = LIGHT_MODE_TARGET_L;
      bgL = Math.max(LIGHT_MODE_MIN_L, Math.min(LIGHT_MODE_MAX_L, bgL));
    }

    // Edge color: darker and more saturated
    const edgeS = Math.min(bgS + 10, 50);
    const edgeL = isDarkMode ? bgL - 8 : bgL - 15;

    // Shadow color: even darker, more saturated
    const shadowS = Math.min(bgS + 20, 60);
    const shadowL = isDarkMode ? 5 : 35;

    // Calculate text color based on background luminance
    const bgRgb = hslToRgb(bgH, bgS, bgL);
    const luminance = getLuminance(bgRgb.r, bgRgb.g, bgRgb.b);

    const useDarkText = luminance > 0.5;
    const textColor = useDarkText ? '#1a1a1a' : '#f5f5f5';
    const textSecondary = useDarkText ? 'rgba(26, 26, 26, 0.8)' : 'rgba(245, 245, 245, 0.8)';
    const textTertiary = useDarkText ? 'rgba(26, 26, 26, 0.6)' : 'rgba(245, 245, 245, 0.6)';

    return {
      background: hslToString(bgH, bgS, bgL),
      backgroundEdge: hslToString(bgH, edgeS, edgeL),
      shadow: hslToString(bgH, shadowS, shadowL, isDarkMode ? 0.4 : 0.25),
      text: textColor,
      textSecondary,
      textTertiary,
      mode: isDarkMode ? 'dark' : 'light',
      ready: true,
    };
  }

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
            resolve(DEFAULT_LIGHT);
            return;
          }

          ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
          const imageData = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
          const dominant = extractDominantColor(imageData);
          const extracted = generateColors(dominant);

          resolve(extracted);
        } catch (error) {
          console.warn('Color extraction failed:', error);
          resolve(DEFAULT_LIGHT);
        }
      };

      img.onerror = () => {
        console.warn('Failed to load image for color extraction');
        resolve(DEFAULT_LIGHT);
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
