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
  extractDominantColor,
  extractColorPalette,
  generateColors,
  type HSL,
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
  });
});
