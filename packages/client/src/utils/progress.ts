export function getProgressTransform(progress: number): string {
  const scale = Number.isFinite(progress)
    ? Math.min(Math.max(progress / 100, 0), 1)
    : 0;
  return `scaleX(${scale})`;
}
