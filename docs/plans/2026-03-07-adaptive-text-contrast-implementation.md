# Adaptive Text Contrast Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace luminance threshold text color selection with WCAG contrast ratio checking so text is always readable against its background.

**Architecture:** Add a `getContrastRatio()` function to `colorUtils.ts`, then replace the hardcoded luminance thresholds in `generateVibrantGradient()` and `generateColors()` with contrast ratio checks against the WCAG AA minimum (4.5:1).

**Tech Stack:** TypeScript, Vitest

---

### Task 1: Add `getContrastRatio` utility function

**Files:**
- Modify: `packages/client/src/composables/colorUtils.ts:170-183`
- Test: `packages/client/src/composables/colorUtils.spec.ts`

**Step 1: Write the failing tests**

Add to the `getLuminance` describe block in `colorUtils.spec.ts`:

```typescript
import {
  rgbToHsl,
  hslToRgb,
  hslToString,
  getLuminance,
  getContrastRatio,  // ADD THIS
  extractDominantColor,
  extractColorPalette,
  generateColors,
  generateVibrantGradient,  // ADD THIS
  type HSL,
} from './colorUtils';
```

Add a new describe block after the `getLuminance` block:

```typescript
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
    // White text on light background — the bug scenario
    const ratio = getContrastRatio({ r: 245, g: 245, b: 245 }, { r: 220, g: 220, b: 220 });
    expect(ratio).toBeLessThan(4.5);
  });

  it('should return high contrast for dark text on light background', () => {
    const ratio = getContrastRatio({ r: 26, g: 26, b: 26 }, { r: 220, g: 220, b: 220 });
    expect(ratio).toBeGreaterThan(4.5);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test -- --run`
Expected: FAIL — `getContrastRatio` is not exported from `colorUtils`

**Step 3: Implement `getContrastRatio`**

Add after `getLuminance` function (after line 183) in `colorUtils.ts`:

```typescript
/**
 * Calculate WCAG contrast ratio between two colors
 * Returns a value between 1 (no contrast) and 21 (max contrast, black on white)
 * WCAG AA requires 4.5:1 for normal text, 3:1 for large text
 */
export function getContrastRatio(color1: RGB, color2: RGB): number {
  const l1 = getLuminance(color1.r, color1.g, color1.b);
  const l2 = getLuminance(color2.r, color2.g, color2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test -- --run`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add packages/client/src/composables/colorUtils.ts packages/client/src/composables/colorUtils.spec.ts
git commit -m "feat(colorUtils): add getContrastRatio utility function"
```

---

### Task 2: Replace threshold in `generateVibrantGradient`

**Files:**
- Modify: `packages/client/src/composables/colorUtils.ts:408-420`
- Test: `packages/client/src/composables/colorUtils.spec.ts`

**Step 1: Write the failing tests**

Add a new describe block for `generateVibrantGradient`:

```typescript
describe('generateVibrantGradient', () => {
  it('should use dark text on light vibrant gradients', () => {
    // Light pastel input — the bug scenario (white on white)
    const dominant: HSL = { h: 200, s: 40, l: 75 };
    const result = generateVibrantGradient(dominant);
    expect(result.text).toBe('#1a1a1a');
  });

  it('should use light text on dark vibrant gradients', () => {
    const dominant: HSL = { h: 200, s: 60, l: 20 };
    const result = generateVibrantGradient(dominant);
    expect(result.text).toBe('#f5f5f5');
  });

  it('should always have sufficient contrast ratio between text and center', () => {
    // Test a range of inputs including edge cases
    const testCases: HSL[] = [
      { h: 0, s: 80, l: 80 },    // Light red
      { h: 60, s: 90, l: 85 },   // Light yellow
      { h: 120, s: 50, l: 75 },  // Light green
      { h: 200, s: 40, l: 75 },  // Light blue (the reported bug)
      { h: 300, s: 30, l: 80 },  // Light purple
      { h: 0, s: 0, l: 90 },     // Near-white
      { h: 0, s: 80, l: 20 },    // Dark red
      { h: 220, s: 60, l: 10 },  // Very dark blue
    ];

    for (const dominant of testCases) {
      const result = generateVibrantGradient(dominant);

      // Parse the center color to get RGB for contrast check
      const centerMatch = result.center.match(/hsl\((\d+), (\d+)%, (\d+)%\)/);
      expect(centerMatch).not.toBeNull();
      const centerRgb = hslToRgb(
        parseInt(centerMatch![1]),
        parseInt(centerMatch![2]),
        parseInt(centerMatch![3])
      );

      // Parse text color to RGB
      const textRgb = result.text === '#1a1a1a'
        ? { r: 26, g: 26, b: 26 }
        : { r: 245, g: 245, b: 245 };

      const ratio = getContrastRatio(textRgb, centerRgb);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test -- --run`
Expected: FAIL — light inputs will produce white text with insufficient contrast

**Step 3: Replace the threshold logic**

In `colorUtils.ts`, replace lines 408-411:

```typescript
  // OLD:
  // const luminance = getLuminance(centerRgb.r, centerRgb.g, centerRgb.b);
  // const useDarkText = luminance > 0.35;

  // NEW:
  const lightText: RGB = { r: 245, g: 245, b: 245 };
  const darkText: RGB = { r: 26, g: 26, b: 26 };
  const lightContrast = getContrastRatio(centerRgb, lightText);
  const darkContrast = getContrastRatio(centerRgb, darkText);

  // Prefer light text (matches dark UI aesthetic) but only if it meets WCAG AA (4.5:1)
  // Otherwise fall back to dark text
  const useDarkText = lightContrast < 4.5 || darkContrast > lightContrast;
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test -- --run`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add packages/client/src/composables/colorUtils.ts packages/client/src/composables/colorUtils.spec.ts
git commit -m "fix(colorUtils): use WCAG contrast ratio for vibrant gradient text color"
```

---

### Task 3: Replace threshold in `generateColors`

**Files:**
- Modify: `packages/client/src/composables/colorUtils.ts:452-460`
- Test: `packages/client/src/composables/colorUtils.spec.ts`

**Step 1: Write the failing test**

Add to the existing `generateColors` describe block:

```typescript
it('should always have sufficient contrast ratio between text and background', () => {
  const testCases: HSL[] = [
    { h: 60, s: 90, l: 85 },   // Light yellow
    { h: 0, s: 80, l: 80 },    // Light red
    { h: 200, s: 40, l: 75 },  // Light blue
    { h: 0, s: 0, l: 90 },     // Near-white
    { h: 0, s: 80, l: 20 },    // Dark red
    { h: 220, s: 60, l: 10 },  // Very dark blue
    { h: 0, s: 0, l: 10 },     // Near-black
  ];

  for (const dominant of testCases) {
    const colors = generateColors(dominant);

    // Parse background color
    const bgMatch = colors.background.match(/hsl\((\d+), (\d+)%, (\d+)%\)/);
    expect(bgMatch).not.toBeNull();
    const bgRgb = hslToRgb(
      parseInt(bgMatch![1]),
      parseInt(bgMatch![2]),
      parseInt(bgMatch![3])
    );

    // Parse text color
    const textRgb = colors.text === '#1a1a1a'
      ? { r: 26, g: 26, b: 26 }
      : { r: 245, g: 245, b: 245 };

    const ratio = getContrastRatio(textRgb, bgRgb);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  }
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test -- --run`
Expected: FAIL — some edge cases may produce insufficient contrast

**Step 3: Replace the threshold logic**

In `colorUtils.ts`, replace lines 452-460:

```typescript
  // OLD:
  // const luminance = getLuminance(bgRgb.r, bgRgb.g, bgRgb.b);
  // const useDarkText = luminance > 0.4;

  // NEW:
  const lightText: RGB = { r: 245, g: 245, b: 245 };
  const darkText: RGB = { r: 26, g: 26, b: 26 };
  const lightContrast = getContrastRatio(bgRgb, lightText);
  const darkContrast = getContrastRatio(bgRgb, darkText);

  // Prefer light text for dark mode aesthetic, but ensure WCAG AA (4.5:1)
  const useDarkText = lightContrast < 4.5 || darkContrast > lightContrast;
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test -- --run`
Expected: All tests PASS

**Step 5: Update the existing tests that hardcode text color expectations**

The existing tests at lines 427-428 and 435-436 hardcode expected text colors:
- `expect(colors.text).toBe('#f5f5f5')` for dark input
- `expect(colors.text).toBe('#1a1a1a')` for light input

These should still pass since the contrast-based logic will produce the same result for clearly dark/light inputs. If any fail, update to check contrast ratio instead of hardcoded values.

**Step 6: Run all tests**

Run: `pnpm test -- --run`
Expected: All 176+ tests PASS

**Step 7: Commit**

```bash
git add packages/client/src/composables/colorUtils.ts packages/client/src/composables/colorUtils.spec.ts
git commit -m "fix(colorUtils): use WCAG contrast ratio for generateColors text color"
```

---

### Task 4: Clean up unused luminance import (if applicable) and final verification

**Files:**
- Modify: `packages/client/src/composables/colorUtils.ts` (only if `getLuminance` is no longer called directly in the text color logic)

**Step 1: Verify `getLuminance` is still used**

`getLuminance` is still used internally by `getContrastRatio`, so no changes needed to exports. Just verify no dead code was left behind.

**Step 2: Run full test suite**

Run: `pnpm test -- --run`
Expected: All tests PASS

**Step 3: Run type checking**

Run: `cd packages/client && pnpm run typecheck`
Expected: No type errors

**Step 4: Commit if any cleanup was needed**

```bash
git add -A
git commit -m "chore: clean up after contrast ratio migration"
```
