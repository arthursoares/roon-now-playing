/**
 * Color extraction utility functions
 * Extracted for testability
 */

export interface HSL {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

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

// Color extraction parameters
export const SAMPLE_SIZE = 50; // Canvas size for sampling
export const HUE_BUCKETS = 12; // Number of hue groups
export const LOW_SATURATION_THRESHOLD = 15; // Below this = grayscale

// Lightness bounds for light mode backgrounds
export const LIGHT_MODE_MIN_L = 75;
export const LIGHT_MODE_MAX_L = 90;
export const LIGHT_MODE_TARGET_S = 30;

// Lightness bounds for dark mode backgrounds
export const DARK_MODE_MIN_L = 10;
export const DARK_MODE_MAX_L = 25;
export const DARK_MODE_TARGET_S = 40;

export const DEFAULT_LIGHT: ExtractedColors = {
  background: 'hsl(30, 20%, 88%)',
  backgroundEdge: 'hsl(30, 25%, 75%)',
  shadow: 'hsla(30, 30%, 40%, 0.25)',
  text: '#1a1a1a',
  textSecondary: 'rgba(26, 26, 26, 0.8)',
  textTertiary: 'rgba(26, 26, 26, 0.6)',
  mode: 'light',
  ready: false,
};

export const DEFAULT_DARK: ExtractedColors = {
  background: 'hsl(220, 15%, 15%)',
  backgroundEdge: 'hsl(220, 20%, 8%)',
  shadow: 'hsla(220, 20%, 5%, 0.4)',
  text: '#f5f5f5',
  textSecondary: 'rgba(245, 245, 245, 0.8)',
  textTertiary: 'rgba(245, 245, 245, 0.6)',
  mode: 'dark',
  ready: false,
};

/**
 * Convert RGB to HSL color space
 */
export function rgbToHsl(r: number, g: number, b: number): HSL {
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

/**
 * Convert HSL to RGB color space
 */
export function hslToRgb(h: number, s: number, l: number): RGB {
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

/**
 * Format HSL values as CSS string
 */
export function hslToString(h: number, s: number, l: number, a?: number): string {
  // Round values for cleaner CSS output
  const rH = Math.round(h);
  const rS = Math.round(s);
  const rL = Math.round(l);

  if (a !== undefined) {
    return `hsla(${rH}, ${rS}%, ${rL}%, ${a})`;
  }
  return `hsl(${rH}, ${rS}%, ${rL}%)`;
}

/**
 * Calculate relative luminance for WCAG contrast calculations
 */
export function getLuminance(r: number, g: number, b: number): number {
  const rsRGB = r / 255;
  const gsRGB = g / 255;
  const bsRGB = b / 255;

  const rL = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
  const gL = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
  const bL = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

  return 0.2126 * rL + 0.7152 * gL + 0.0722 * bL;
}

/**
 * Extract dominant color from image data using hue buckets
 */
export function extractDominantColor(imageData: ImageData): HSL {
  const pixels = imageData.data;
  const hueBuckets: { colors: HSL[]; count: number; saturationSum: number }[] = Array.from(
    { length: HUE_BUCKETS },
    () => ({ colors: [], count: 0, saturationSum: 0 })
  );

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

    // Only consider pixels with meaningful saturation for hue analysis
    if (hsl.s >= 10) {
      const bucketIndex = Math.floor(hsl.h / (360 / HUE_BUCKETS)) % HUE_BUCKETS;
      hueBuckets[bucketIndex].colors.push(hsl);
      hueBuckets[bucketIndex].count++;
      hueBuckets[bucketIndex].saturationSum += hsl.s;
    }
  }

  const avgSaturation = pixelCount > 0 ? totalSaturation / pixelCount : 0;

  // If image is essentially grayscale, return neutral color
  if (avgSaturation < LOW_SATURATION_THRESHOLD) {
    // Calculate average lightness to determine warm vs cool gray
    let totalLightness = 0;
    let lCount = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] >= 128) {
        const hsl = rgbToHsl(pixels[i], pixels[i + 1], pixels[i + 2]);
        totalLightness += hsl.l;
        lCount++;
      }
    }
    const avgLightness = lCount > 0 ? totalLightness / lCount : 50;

    // Neutral gray with slight warm or cool tint
    return { h: 220, s: 5, l: Math.round(avgLightness) };
  }

  // Find the bucket with highest average saturation (most vibrant colors)
  let bestBucket = hueBuckets[0];
  let bestScore = 0;

  for (const bucket of hueBuckets) {
    if (bucket.count === 0) continue;

    // Score based on count and average saturation
    const avgBucketSat = bucket.saturationSum / bucket.count;
    const score = bucket.count * (avgBucketSat / 100);

    if (score > bestScore) {
      bestScore = score;
      bestBucket = bucket;
    }
  }

  // No valid bucket found
  if (bestBucket.colors.length === 0) {
    return { h: 30, s: 20, l: 50 };
  }

  // Calculate weighted average of colors in the best bucket
  // Weight by saturation to prefer more vibrant samples
  let weightedH = 0;
  let weightedS = 0;
  let weightedL = 0;
  let totalWeight = 0;

  for (const color of bestBucket.colors) {
    const weight = color.s / 100;
    weightedH += color.h * weight;
    weightedS += color.s * weight;
    weightedL += color.l * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) {
    return { h: 30, s: 20, l: 50 };
  }

  return {
    h: Math.round(weightedH / totalWeight),
    s: Math.round(weightedS / totalWeight),
    l: Math.round(weightedL / totalWeight),
  };
}

/**
 * Generate vibrant gradient colors that preserve more of the original saturation
 * Used for gradient-radial and gradient-linear backgrounds
 */
export function generateVibrantGradient(dominant: HSL): {
  center: string;
  edge: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  mode: 'light' | 'dark';
} {
  const isDarkMode = dominant.l <= 50;

  // Preserve much more of the original saturation
  // For vibrant images, keep saturation high; for muted images, boost it slightly
  const centerS = Math.max(dominant.s * 0.85, 50);

  // Center lightness: keep it visible but not too bright
  const centerL = isDarkMode
    ? Math.max(25, Math.min(40, dominant.l * 0.8))
    : Math.min(75, Math.max(60, dominant.l * 0.9));

  // Edge: much darker and can be even more saturated for drama
  const edgeS = Math.min(centerS + 15, 95);
  const edgeL = isDarkMode
    ? Math.max(5, centerL - 20)
    : Math.max(40, centerL - 25);

  // Calculate text color based on center luminance
  const centerRgb = hslToRgb(dominant.h, centerS, centerL);
  const luminance = getLuminance(centerRgb.r, centerRgb.g, centerRgb.b);
  const useDarkText = luminance > 0.35;

  return {
    center: hslToString(dominant.h, centerS, centerL),
    edge: hslToString(dominant.h, edgeS, edgeL),
    text: useDarkText ? '#1a1a1a' : '#f5f5f5',
    textSecondary: useDarkText ? 'rgba(26, 26, 26, 0.8)' : 'rgba(245, 245, 245, 0.85)',
    textTertiary: useDarkText ? 'rgba(26, 26, 26, 0.6)' : 'rgba(245, 245, 245, 0.7)',
    mode: isDarkMode ? 'dark' : 'light',
  };
}

/**
 * Generate full color scheme from a dominant color
 */
export function generateColors(dominant: HSL): ExtractedColors {
  // Determine mode based on original image lightness
  const isDarkMode = dominant.l <= 50;

  const bgH = dominant.h;
  let bgS: number;
  let bgL: number;

  if (isDarkMode) {
    // Dark mode: use the hue with adjusted saturation and low lightness
    bgS = Math.min(Math.max(dominant.s * 0.5, 15), DARK_MODE_TARGET_S);
    bgL = Math.max(DARK_MODE_MIN_L, Math.min(DARK_MODE_MAX_L, 15));
  } else {
    // Light mode: use the hue with lower saturation and high lightness
    bgS = Math.min(Math.max(dominant.s * 0.35, 15), LIGHT_MODE_TARGET_S);
    bgL = Math.max(LIGHT_MODE_MIN_L, Math.min(LIGHT_MODE_MAX_L, 85));
  }

  // Edge color: darker and slightly more saturated
  const edgeS = Math.min(bgS + 8, isDarkMode ? 50 : 40);
  const edgeL = isDarkMode ? Math.max(5, bgL - 7) : Math.max(60, bgL - 12);

  // Shadow color: much darker, more saturated for color depth
  const shadowS = Math.min(bgS + 15, 50);
  const shadowL = isDarkMode ? 5 : 30;

  // Calculate text color based on background luminance
  const bgRgb = hslToRgb(bgH, bgS, bgL);
  const luminance = getLuminance(bgRgb.r, bgRgb.g, bgRgb.b);

  // Use dark text on light backgrounds, light text on dark backgrounds
  const useDarkText = luminance > 0.4;
  const textColor = useDarkText ? '#1a1a1a' : '#f5f5f5';
  const textSecondary = useDarkText ? 'rgba(26, 26, 26, 0.75)' : 'rgba(245, 245, 245, 0.8)';
  const textTertiary = useDarkText ? 'rgba(26, 26, 26, 0.55)' : 'rgba(245, 245, 245, 0.6)';

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
