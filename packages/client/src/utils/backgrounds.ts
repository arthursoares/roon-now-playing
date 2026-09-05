import type { BackgroundType } from '@roon-screen-cover/shared';

export const DYNAMIC_BACKGROUND_TYPES = [
  'gradient-linear-multi',
  'gradient-radial-corner',
  'gradient-mesh',
  'blur-subtle',
  'blur-heavy',
  'duotone',
  'posterized',
  'gradient-noise',
  'blur-grain',
] as const satisfies readonly BackgroundType[];

const dynamicBackgroundTypes: ReadonlySet<BackgroundType> = new Set(DYNAMIC_BACKGROUND_TYPES);

export function isDynamicBackground(background: BackgroundType): boolean {
  return dynamicBackgroundTypes.has(background);
}
