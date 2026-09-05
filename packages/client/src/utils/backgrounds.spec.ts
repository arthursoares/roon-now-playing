import { describe, expect, it } from 'vitest';
import { BACKGROUNDS } from '@roon-screen-cover/shared';
import { DYNAMIC_BACKGROUND_TYPES, isDynamicBackground } from './backgrounds';

describe('dynamic background classification', () => {
  it('classifies every supported background consistently', () => {
    for (const background of BACKGROUNDS) {
      expect(isDynamicBackground(background)).toBe(DYNAMIC_BACKGROUND_TYPES.includes(
        background as (typeof DYNAMIC_BACKGROUND_TYPES)[number]
      ));
    }
  });
});
