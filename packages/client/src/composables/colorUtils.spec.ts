/**
 * Test Plan: Color Extraction Utilities
 *
 * Scenario: RGB to HSL conversion
 *   Given RGB color values
 *   When converted to HSL
 *   Then the HSL values should be correct
 *
 * Scenario: HSL to RGB conversion
 *   Given HSL color values
 *   When converted to RGB
 *   Then the RGB values should be correct
 *
 * Scenario: Dominant color extraction
 *   Given image data with known colors
 *   When extracting dominant color
 *   Then the correct dominant hue should be identified
 *
 * Scenario: Color scheme generation
 *   Given a dominant HSL color
 *   When generating a color scheme
 *   Then appropriate background and text colors should be produced
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  rgbToHsl,
  hslToRgb,
  hslToString,
  getLuminance,
  getContrastRatio,
  extractDominantColor,
  extractColorPalette,
  generateColors,
  generateVibrantGradient,
  type HSL,
  type RGB,
} from './colorUtils';

// Polyfill ImageData for Node.js environment
class ImageDataPolyfill {
  data: Uint8ClampedArray;
  width: number;
  height: number;

  constructor(data: Uint8ClampedArray, width: number, height?: number) {
    this.data = data;
    this.width = width;
    this.height = height ?? data.length / 4 / width;
  }
}

beforeAll(() => {
  if (typeof globalThis.ImageData === 'undefined') {
    (globalThis as any).ImageData = ImageDataPolyfill;
  }
});

// Helper to create ImageData for tests
function createImageData(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  return new ImageData(data, width, height);
}

describe('Color Utilities', () => {
  describe('rgbToHsl', () => {
    it('should convert pure red correctly', () => {
      const hsl = rgbToHsl(255, 0, 0);
      expect(hsl.h).toBe(0);
      expect(hsl.s).toBe(100);
      expect(hsl.l).toBe(50);
    });

    it('should convert pure green correctly', () => {
      const hsl = rgbToHsl(0, 255, 0);
      expect(hsl.h).toBe(120);
      expect(hsl.s).toBe(100);
      expect(hsl.l).toBe(50);
    });

    it('should convert pure blue correctly', () => {
      const hsl = rgbToHsl(0, 0, 255);
      expect(hsl.h).toBe(240);
      expect(hsl.s).toBe(100);
      expect(hsl.l).toBe(50);
    });

    it('should convert white correctly', () => {
      const hsl = rgbToHsl(255, 255, 255);
      expect(hsl.h).toBe(0);
      expect(hsl.s).toBe(0);
      expect(hsl.l).toBe(100);
    });

    it('should convert black correctly', () => {
      const hsl = rgbToHsl(0, 0, 0);
      expect(hsl.h).toBe(0);
      expect(hsl.s).toBe(0);
      expect(hsl.l).toBe(0);
    });

    it('should convert gray correctly', () => {
      const hsl = rgbToHsl(128, 128, 128);
      expect(hsl.h).toBe(0);
      expect(hsl.s).toBe(0);
      expect(hsl.l).toBe(50);
    });

    it('should convert orange correctly', () => {
      const hsl = rgbToHsl(255, 165, 0);
      expect(hsl.h).toBeGreaterThanOrEqual(38);
      expect(hsl.h).toBeLessThanOrEqual(40);
      expect(hsl.s).toBe(100);
      expect(hsl.l).toBe(50);
    });

    it('should convert cyan correctly', () => {
      const hsl = rgbToHsl(0, 255, 255);
      expect(hsl.h).toBe(180);
      expect(hsl.s).toBe(100);
      expect(hsl.l).toBe(50);
    });

    it('should convert magenta correctly', () => {
      const hsl = rgbToHsl(255, 0, 255);
      expect(hsl.h).toBe(300);
      expect(hsl.s).toBe(100);
      expect(hsl.l).toBe(50);
    });

    it('should convert a desaturated color correctly', () => {
      const hsl = rgbToHsl(200, 180, 180);
      expect(hsl.s).toBeLessThan(20);
      expect(hsl.l).toBeGreaterThan(70);
    });
  });

  describe('hslToRgb', () => {
    it('should convert pure red correctly', () => {
      const rgb = hslToRgb(0, 100, 50);
      expect(rgb.r).toBe(255);
      expect(rgb.g).toBe(0);
      expect(rgb.b).toBe(0);
    });

    it('should convert pure green correctly', () => {
      const rgb = hslToRgb(120, 100, 50);
      expect(rgb.r).toBe(0);
      expect(rgb.g).toBe(255);
      expect(rgb.b).toBe(0);
    });

    it('should convert pure blue correctly', () => {
      const rgb = hslToRgb(240, 100, 50);
      expect(rgb.r).toBe(0);
      expect(rgb.g).toBe(0);
      expect(rgb.b).toBe(255);
    });

    it('should convert white correctly', () => {
      const rgb = hslToRgb(0, 0, 100);
      expect(rgb.r).toBe(255);
      expect(rgb.g).toBe(255);
      expect(rgb.b).toBe(255);
    });

    it('should convert black correctly', () => {
      const rgb = hslToRgb(0, 0, 0);
      expect(rgb.r).toBe(0);
      expect(rgb.g).toBe(0);
      expect(rgb.b).toBe(0);
    });

    it('should convert gray correctly', () => {
      const rgb = hslToRgb(0, 0, 50);
      expect(rgb.r).toBe(128);
      expect(rgb.g).toBe(128);
      expect(rgb.b).toBe(128);
    });

    it('should be inverse of rgbToHsl', () => {
      // Test round-trip conversion
      const original = { r: 180, g: 100, b: 220 };
      const hsl = rgbToHsl(original.r, original.g, original.b);
      const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);

      // Allow small rounding differences
      expect(Math.abs(rgb.r - original.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(rgb.g - original.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(rgb.b - original.b)).toBeLessThanOrEqual(1);
    });
  });

  describe('hslToString', () => {
    it('should format HSL without alpha', () => {
      expect(hslToString(180, 50, 60)).toBe('hsl(180, 50%, 60%)');
    });

    it('should format HSLA with alpha', () => {
      expect(hslToString(180, 50, 60, 0.5)).toBe('hsla(180, 50%, 60%, 0.5)');
    });

    it('should handle edge values', () => {
      expect(hslToString(0, 0, 0)).toBe('hsl(0, 0%, 0%)');
      expect(hslToString(360, 100, 100)).toBe('hsl(360, 100%, 100%)');
    });
  });

  describe('getLuminance', () => {
    it('should return 1 for white', () => {
      const luminance = getLuminance(255, 255, 255);
      expect(luminance).toBeCloseTo(1, 2);
    });

    it('should return 0 for black', () => {
      const luminance = getLuminance(0, 0, 0);
      expect(luminance).toBe(0);
    });

    it('should return higher value for light colors', () => {
      const lightLum = getLuminance(200, 200, 200);
      const darkLum = getLuminance(50, 50, 50);
      expect(lightLum).toBeGreaterThan(darkLum);
    });

    it('should weight green higher than red and blue', () => {
      const redLum = getLuminance(255, 0, 0);
      const greenLum = getLuminance(0, 255, 0);
      const blueLum = getLuminance(0, 0, 255);

      expect(greenLum).toBeGreaterThan(redLum);
      expect(greenLum).toBeGreaterThan(blueLum);
    });
  });

  describe('getContrastRatio', () => {
    it('should return 21:1 for black on white', () => {
      const ratio = getContrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
      expect(ratio).toBeCloseTo(21, 0);
    });

    it('should return 1:1 for same colors', () => {
      const ratio = getContrastRatio({ r: 128, g: 128, b: 128 }, { r: 128, g: 128, b: 128 });
      expect(ratio).toBeCloseTo(1, 1);
    });

    it('should be commutative (order of arguments does not matter)', () => {
      const ratio1 = getContrastRatio({ r: 0, g: 0, b: 0 }, { r: 200, g: 200, b: 200 });
      const ratio2 = getContrastRatio({ r: 200, g: 200, b: 200 }, { r: 0, g: 0, b: 0 });
      expect(ratio1).toBeCloseTo(ratio2, 5);
    });

    it('should return low contrast for similar light colors', () => {
      const ratio = getContrastRatio({ r: 245, g: 245, b: 245 }, { r: 220, g: 220, b: 220 });
      expect(ratio).toBeLessThan(4.5);
    });

    it('should return high contrast for dark text on light background', () => {
      const ratio = getContrastRatio({ r: 26, g: 26, b: 26 }, { r: 220, g: 220, b: 220 });
      expect(ratio).toBeGreaterThan(4.5);
    });
  });

  describe('extractDominantColor', () => {
    function createImageData(width: number, height: number, fillFn: (x: number, y: number) => [number, number, number, number]): ImageData {
      const data = new Uint8ClampedArray(width * height * 4);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const [r, g, b, a] = fillFn(x, y);
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = a;
        }
      }
      return new ImageData(data, width, height);
    }

    it('should extract red from a fully red image', () => {
      const imageData = createImageData(10, 10, () => [255, 0, 0, 255]);
      const dominant = extractDominantColor(imageData);

      expect(dominant.h).toBeLessThanOrEqual(15); // Red is around 0
      expect(dominant.s).toBeGreaterThan(80);
    });

    it('should extract blue from a fully blue image', () => {
      const imageData = createImageData(10, 10, () => [0, 0, 255, 255]);
      const dominant = extractDominantColor(imageData);

      expect(dominant.h).toBeGreaterThanOrEqual(220);
      expect(dominant.h).toBeLessThanOrEqual(250);
      expect(dominant.s).toBeGreaterThan(80);
    });

    it('should extract green from a fully green image', () => {
      const imageData = createImageData(10, 10, () => [0, 255, 0, 255]);
      const dominant = extractDominantColor(imageData);

      expect(dominant.h).toBeGreaterThanOrEqual(100);
      expect(dominant.h).toBeLessThanOrEqual(140);
      expect(dominant.s).toBeGreaterThan(80);
    });

    it('should identify grayscale images', () => {
      const imageData = createImageData(10, 10, () => [128, 128, 128, 255]);
      const dominant = extractDominantColor(imageData);

      // Grayscale returns neutral color with low saturation
      expect(dominant.s).toBeLessThanOrEqual(10);
    });

    it('should find dominant color in mixed image', () => {
      // 70% blue, 30% red
      const imageData = createImageData(10, 10, (x, y) => {
        const index = y * 10 + x;
        if (index < 70) {
          return [0, 0, 255, 255]; // Blue
        }
        return [255, 0, 0, 255]; // Red
      });
      const dominant = extractDominantColor(imageData);

      // Should be blue-ish
      expect(dominant.h).toBeGreaterThanOrEqual(200);
      expect(dominant.h).toBeLessThanOrEqual(260);
    });

    it('should skip transparent pixels', () => {
      const imageData = createImageData(10, 10, (x) => {
        if (x < 5) {
          return [255, 0, 0, 0]; // Transparent red
        }
        return [0, 0, 255, 255]; // Opaque blue
      });
      const dominant = extractDominantColor(imageData);

      // Should be blue (ignoring transparent red)
      expect(dominant.h).toBeGreaterThanOrEqual(220);
      expect(dominant.h).toBeLessThanOrEqual(250);
    });

    it('should prefer saturated colors over desaturated ones', () => {
      // Mix of vibrant blue and desaturated pinkish
      const imageData = createImageData(10, 10, (x, y) => {
        const index = y * 10 + x;
        if (index < 50) {
          return [200, 180, 190, 255]; // Low saturation pink
        }
        return [0, 100, 255, 255]; // Vibrant blue
      });
      const dominant = extractDominantColor(imageData);

      // Should lean toward blue due to higher saturation
      expect(dominant.h).toBeGreaterThan(180);
    });
  });

  describe('extractColorPalette', () => {
    it('should return up to 5 colors sorted by prominence', () => {
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
          // Red
          imageData.data[i] = 200;
          imageData.data[i + 1] = 50;
          imageData.data[i + 2] = 50;
        } else {
          // Green
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
      expect(palette.length).toBe(1);
    });

    it('should respect maxColors parameter', () => {
      const imageData = createImageData(50, 50);
      // Fill with 4 distinct colors
      for (let i = 0; i < imageData.data.length; i += 4) {
        const pixel = i / 4;
        if (pixel < 625) {
          imageData.data[i] = 200;
          imageData.data[i + 1] = 50;
          imageData.data[i + 2] = 50; // Red
        } else if (pixel < 1250) {
          imageData.data[i] = 50;
          imageData.data[i + 1] = 200;
          imageData.data[i + 2] = 50; // Green
        } else if (pixel < 1875) {
          imageData.data[i] = 50;
          imageData.data[i + 1] = 50;
          imageData.data[i + 2] = 200; // Blue
        } else {
          imageData.data[i] = 200;
          imageData.data[i + 1] = 200;
          imageData.data[i + 2] = 50; // Yellow
        }
        imageData.data[i + 3] = 255;
      }

      const palette = extractColorPalette(imageData, 2);
      expect(palette.length).toBeLessThanOrEqual(2);
    });

    it('should return empty array for fully transparent image', () => {
      const imageData = createImageData(10, 10);
      // All pixels are transparent (alpha = 0 by default)
      const palette = extractColorPalette(imageData);
      expect(palette.length).toBe(0);
    });
  });

  describe('generateColors', () => {
    it('should generate dark mode colors for dark input', () => {
      const dominant: HSL = { h: 220, s: 60, l: 30 };
      const colors = generateColors(dominant);

      expect(colors.mode).toBe('dark');
      expect(colors.text).toBe('#f5f5f5');
      expect(colors.ready).toBe(true);
    });

    it('should generate light mode colors for light input', () => {
      const dominant: HSL = { h: 40, s: 60, l: 70 };
      const colors = generateColors(dominant);

      expect(colors.mode).toBe('light');
      expect(colors.text).toBe('#1a1a1a');
      expect(colors.ready).toBe(true);
    });

    it('should preserve hue in generated background', () => {
      const dominant: HSL = { h: 120, s: 50, l: 40 }; // Green
      const colors = generateColors(dominant);

      // Background should contain the same hue
      expect(colors.background).toContain('hsl(120');
    });

    it('should generate valid CSS color strings', () => {
      const dominant: HSL = { h: 200, s: 50, l: 50 };
      const colors = generateColors(dominant);

      expect(colors.background).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/);
      expect(colors.backgroundEdge).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/);
      expect(colors.shadow).toMatch(/^hsla\(\d+, \d+%, \d+%, [\d.]+\)$/);
    });

    it('should generate lighter background for light mode', () => {
      const dominant: HSL = { h: 180, s: 50, l: 70 };
      const colors = generateColors(dominant);

      // Extract lightness from background (format: "hsl(180, 18%, 85%)")
      const match = colors.background.match(/hsl\(\d+, \d+%, (\d+)%\)/);
      expect(match).not.toBeNull();
      const lightness = parseInt(match![1]);
      expect(lightness).toBeGreaterThanOrEqual(75);
    });

    it('should generate darker background for dark mode', () => {
      const dominant: HSL = { h: 180, s: 50, l: 30 };
      const colors = generateColors(dominant);

      // Extract lightness from background
      const match = colors.background.match(/hsl\(\d+, \d+%, (\d+)%\)/);
      expect(match).not.toBeNull();
      const lightness = parseInt(match![1]);
      expect(lightness).toBeLessThanOrEqual(25);
    });

    it('should generate edge color darker than background', () => {
      const dominant: HSL = { h: 200, s: 50, l: 50 };
      const colors = generateColors(dominant);

      const bgMatch = colors.background.match(/hsl\(\d+, \d+%, (\d+)%\)/);
      const edgeMatch = colors.backgroundEdge.match(/hsl\(\d+, \d+%, (\d+)%\)/);

      expect(bgMatch).not.toBeNull();
      expect(edgeMatch).not.toBeNull();

      const bgL = parseInt(bgMatch![1]);
      const edgeL = parseInt(edgeMatch![1]);
      expect(edgeL).toBeLessThan(bgL);
    });

    it('should handle grayscale input', () => {
      const dominant: HSL = { h: 0, s: 5, l: 50 };
      const colors = generateColors(dominant);

      expect(colors.ready).toBe(true);
      expect(colors.background).toBeDefined();
      expect(colors.text).toBeDefined();
    });

    it('should handle extreme saturation values', () => {
      const highSat: HSL = { h: 200, s: 100, l: 50 };
      const lowSat: HSL = { h: 200, s: 0, l: 50 };

      const highColors = generateColors(highSat);
      const lowColors = generateColors(lowSat);

      expect(highColors.ready).toBe(true);
      expect(lowColors.ready).toBe(true);
    });

    it('should meet WCAG 4.5:1 contrast ratio across diverse HSL inputs', () => {
      const testInputs: HSL[] = [
        { h: 0, s: 80, l: 30 },    // Dark red
        { h: 60, s: 90, l: 75 },   // Light yellow
        { h: 120, s: 50, l: 40 },  // Mid green
        { h: 180, s: 60, l: 80 },  // Light cyan
        { h: 210, s: 70, l: 25 },  // Dark blue
        { h: 300, s: 50, l: 70 },  // Light magenta
        { h: 0, s: 0, l: 90 },     // Near-white gray
      ];

      for (const input of testInputs) {
        const colors = generateColors(input);
        const bgMatch = colors.background.match(/hsl\((\d+), (\d+)%, (\d+)%\)/);
        expect(bgMatch).not.toBeNull();
        const bgRgb = hslToRgb(parseInt(bgMatch![1]), parseInt(bgMatch![2]), parseInt(bgMatch![3]));
        const textRgb: RGB = colors.text === '#1a1a1a'
          ? { r: 26, g: 26, b: 26 }
          : { r: 245, g: 245, b: 245 };
        const contrast = getContrastRatio(bgRgb, textRgb);
        expect(contrast).toBeGreaterThanOrEqual(4.5);
      }
    });
  });

  describe('generateVibrantGradient', () => {
    it('should produce dark text on light pastel backgrounds', () => {
      const lightPastel: HSL = { h: 60, s: 80, l: 80 };
      const result = generateVibrantGradient(lightPastel);
      expect(result.text).toBe('#1a1a1a');
      expect(result.mode).toBe('light');
    });

    it('should produce light text on dark backgrounds', () => {
      const darkInput: HSL = { h: 240, s: 70, l: 20 };
      const result = generateVibrantGradient(darkInput);
      expect(result.text).toBe('#f5f5f5');
      expect(result.mode).toBe('dark');
    });

    it('should always pick the text color with higher contrast and meet WCAG large text (3:1)', () => {
      const testInputs: HSL[] = [
        { h: 0, s: 90, l: 30 },    // Dark red
        { h: 50, s: 85, l: 75 },   // Light gold
        { h: 120, s: 60, l: 45 },  // Mid green
        { h: 180, s: 70, l: 70 },  // Light cyan
        { h: 220, s: 80, l: 25 },  // Dark blue
        { h: 280, s: 65, l: 60 },  // Mid purple
        { h: 330, s: 75, l: 80 },  // Light pink
        { h: 0, s: 0, l: 50 },     // Mid gray
      ];

      const lightText: RGB = { r: 245, g: 245, b: 245 };
      const darkText: RGB = { r: 26, g: 26, b: 26 };

      for (const input of testInputs) {
        const result = generateVibrantGradient(input);
        const centerMatch = result.center.match(/hsl\((\d+), (\d+)%, (\d+)%\)/);
        expect(centerMatch).not.toBeNull();
        const centerRgb = hslToRgb(parseInt(centerMatch![1]), parseInt(centerMatch![2]), parseInt(centerMatch![3]));

        const lightContrast = getContrastRatio(centerRgb, lightText);
        const darkContrast = getContrastRatio(centerRgb, darkText);
        const chosenContrast = Math.max(lightContrast, darkContrast);

        // Should pick the text color with higher contrast
        if (result.text === '#1a1a1a') {
          expect(darkContrast).toBeGreaterThanOrEqual(lightContrast);
        } else {
          expect(lightContrast).toBeGreaterThanOrEqual(darkContrast);
        }

        // Should meet at least WCAG AA large text (3:1)
        expect(chosenContrast).toBeGreaterThanOrEqual(3);
      }
    });
  });
});
