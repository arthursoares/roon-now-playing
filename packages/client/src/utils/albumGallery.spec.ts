import { describe, expect, it } from 'vitest';
import { calculateAlbumGalleryGeometry } from './albumGallery';

describe('calculateAlbumGalleryGeometry', () => {
  const viewports = [
    { width: 1194, height: 834 },
    { width: 834, height: 1194 },
    { width: 1920, height: 1080 },
    { width: 3840, height: 2160 },
  ];

  it('covers each viewport with at least forty regular square slots', () => {
    for (const viewport of viewports) {
      for (let count = 1; count <= 12; count++) {
        const geometry = calculateAlbumGalleryGeometry(count, viewport.width, viewport.height);
        const tileSizes = geometry.rowLengths.map((length) => geometry.canvasWidth / length);

        expect(geometry.rowLengths.reduce((sum, length) => sum + length, 0)).toBeGreaterThanOrEqual(40);
        expect(new Set(geometry.rowLengths)).toHaveLength(1);
        expect(Number.isFinite(geometry.canvasWidth)).toBe(true);
        expect(Number.isFinite(geometry.canvasHeight)).toBe(true);
        expect(geometry.canvasWidth).toBeGreaterThanOrEqual(viewport.width - 0.001);
        expect(geometry.canvasHeight).toBeGreaterThanOrEqual(viewport.height - 0.001);
        expect(tileSizes.reduce((sum, size) => sum + size, 0)).toBeCloseTo(geometry.canvasHeight, 6);
        expect(
          Math.abs(geometry.canvasWidth - viewport.width) < 0.001
          || Math.abs(geometry.canvasHeight - viewport.height) < 0.001
        ).toBe(true);
      }
    }
  });

  it('selects an eight-by-five mosaic on wide screens and a narrower portrait mosaic', () => {
    expect(calculateAlbumGalleryGeometry(1, 1920, 1080).rowLengths).toEqual([8, 8, 8, 8, 8]);
    expect(calculateAlbumGalleryGeometry(12, 3840, 2160).rowLengths).toEqual([8, 8, 8, 8, 8]);
    expect(calculateAlbumGalleryGeometry(3, 834, 1194).rowLengths).toEqual(
      [5, 5, 5, 5, 5, 5, 5, 5]
    );
  });

  it('returns safe finite dimensions before a viewport has measurable size', () => {
    expect(calculateAlbumGalleryGeometry(0, 0, Number.NaN)).toEqual({
      rowLengths: [],
      canvasWidth: 1,
      canvasHeight: 1,
    });
  });
});
