export interface AlbumGalleryGeometry {
  rowLengths: number[];
  canvasWidth: number;
  canvasHeight: number;
}

function balancedRows(itemCount: number, rowCount: number): number[] {
  const shortLength = Math.floor(itemCount / rowCount);
  const longerRows = itemCount % rowCount;
  return Array.from(
    { length: rowCount },
    (_, index) => shortLength + (index < longerRows ? 1 : 0)
  );
}

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

  const viewportAspect = width / height;
  let rowLengths = [count];
  let bestDifference = Number.POSITIVE_INFINITY;

  for (let rowCount = 1; rowCount <= count; rowCount++) {
    const candidate = balancedRows(count, rowCount);
    const normalizedHeight = candidate.reduce((sum, rowLength) => sum + 1 / rowLength, 0);
    const difference = Math.abs(Math.log(viewportAspect * normalizedHeight));
    if (difference < bestDifference) {
      bestDifference = difference;
      rowLengths = candidate;
    }
  }

  const normalizedHeight = rowLengths.reduce((sum, rowLength) => sum + 1 / rowLength, 0);
  const canvasWidth = width * Math.max(1, height / (width * normalizedHeight));

  return {
    rowLengths,
    canvasWidth,
    canvasHeight: canvasWidth * normalizedHeight,
  };
}
