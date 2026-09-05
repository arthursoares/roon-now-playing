export interface AlbumGalleryGeometry {
  rowLengths: number[];
  canvasWidth: number;
  canvasHeight: number;
}

const MINIMUM_GALLERY_SLOTS = 40;

export function calculateAlbumGalleryGeometry(
  itemCount: number,
  viewportWidth: number,
  viewportHeight: number
): AlbumGalleryGeometry {
  const count = Math.max(0, Math.floor(Number.isFinite(itemCount) ? itemCount : 0));
  const width = Math.max(1, Number.isFinite(viewportWidth) ? viewportWidth : 1);
  const height = Math.max(1, Number.isFinite(viewportHeight) ? viewportHeight : 1);

  if (count === 0) {
    return { rowLengths: [], canvasWidth: width, canvasHeight: height };
  }

  const slotCount = Math.max(MINIMUM_GALLERY_SLOTS, count);
  const columnCount = Math.max(1, Math.round(Math.sqrt(slotCount * width / height)));
  const rowCount = Math.ceil(slotCount / columnCount);
  const tileSize = Math.max(width / columnCount, height / rowCount);
  const canvasWidth = tileSize * columnCount;

  return {
    rowLengths: Array.from({ length: rowCount }, () => columnCount),
    canvasWidth,
    canvasHeight: tileSize * rowCount,
  };
}
