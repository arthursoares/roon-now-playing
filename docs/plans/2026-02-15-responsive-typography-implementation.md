# Responsive Typography Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace viewport-based `clamp()` typography with centralized tokens and container queries for consistent sizing across tablets, desktops, and TVs.

**Architecture:** Create shared CSS tokens file with typography scale, then migrate each layout to use container queries that scale text based on component width rather than viewport width.

**Tech Stack:** CSS Container Queries, CSS Custom Properties, Vue 3 scoped styles

---

## Task 1: Create Typography Tokens

**Files:**
- Create: `packages/client/src/styles/tokens.css`
- Modify: `packages/client/src/main.ts`

**Step 1: Create the tokens file**

Create `packages/client/src/styles/tokens.css`:

```css
/**
 * Typography Design Tokens
 * Scale: 1.25 ratio (major third)
 * Base: 1rem = 16px
 */

:root {
  /* Typography Scale */
  --text-xs: 0.64rem;      /* 10px - zone hints, timestamps */
  --text-sm: 0.8rem;       /* 13px - secondary info */
  --text-base: 1rem;       /* 16px - body text */
  --text-lg: 1.25rem;      /* 20px - artist/album */
  --text-xl: 1.563rem;     /* 25px - titles */
  --text-2xl: 1.953rem;    /* 31px - facts (tablet) */
  --text-3xl: 2.441rem;    /* 39px - facts (desktop) */
  --text-4xl: 3.052rem;    /* 49px - facts (TV) */
  --text-5xl: 3.815rem;    /* 61px - facts (4K) */

  /* Line Heights */
  --leading-tight: 1.1;
  --leading-snug: 1.25;
  --leading-normal: 1.4;

  /* Font Weights */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;

  /* Container Query Breakpoints (for reference in comments) */
  /* sm: < 500px */
  /* md: 500-699px */
  /* lg: 700-999px */
  /* xl: 1000-1399px */
  /* 2xl: >= 1400px */
}
```

**Step 2: Import tokens in main.ts**

Add import at top of `packages/client/src/main.ts`:

```typescript
import { createApp } from 'vue';
import './styles/tokens.css';
import App from './App.vue';
import router from './router';

createApp(App).use(router).mount('#app');
```

**Step 3: Verify tokens load**

Run: `pnpm run dev`
Open: http://localhost:5174/typography-test
Verify: Page still renders (tokens don't break anything)

**Step 4: Commit**

```bash
git add packages/client/src/styles/tokens.css packages/client/src/main.ts
git commit -m "feat: add typography design tokens"
```

---

## Task 2: Migrate FactsColumnsLayout - Add Container Setup

**Files:**
- Modify: `packages/client/src/layouts/FactsColumnsLayout.vue`

**Step 1: Add container-type to layout root**

In `FactsColumnsLayout.vue`, find the `.facts-columns-layout` CSS rule and add container properties:

```css
.facts-columns-layout {
  /* Add these lines at the top of the rule */
  container-type: inline-size;
  container-name: layout;

  /* ... existing styles ... */
}
```

**Step 2: Add container-type to .content**

Find `.content` rule and add:

```css
.content {
  container-type: inline-size;
  container-name: content;

  /* ... existing styles ... */
}
```

**Step 3: Verify layout still works**

Run: `pnpm run dev`
Open: http://localhost:5174/?layout=facts-columns
Verify: Layout renders normally (container-type shouldn't change appearance)

**Step 4: Commit**

```bash
git add packages/client/src/layouts/FactsColumnsLayout.vue
git commit -m "feat(FactsColumnsLayout): add container query setup"
```

---

## Task 3: Migrate FactsColumnsLayout - Replace Font Variables

**Files:**
- Modify: `packages/client/src/layouts/FactsColumnsLayout.vue`

**Step 1: Remove old font variables from .facts-columns-layout**

Remove these lines from `.facts-columns-layout`:

```css
/* DELETE THESE LINES */
  --font-fact: clamp(22px, 3vw, 72px);
  --line-height-fact: 1.2;
  --font-title: clamp(18px, 2.2vw, 52px);
  --line-height-title: 1.1;
  --font-artist-album: clamp(14px, 1.6vw, 38px);
  --line-height-artist-album: 1.15;
  --font-zone: clamp(14px, 1.5vw, 36px);
  --font-loading: clamp(18px, 2vw, 48px);
  --font-error: clamp(16px, 1.8vw, 42px);
  --font-no-playback: clamp(24px, 3vw, 72px);
  --font-zone-hint: clamp(16px, 2vw, 48px);
```

**Step 2: Update .fact-text to use tokens**

Replace the `.fact-text` font-size:

```css
.fact-text {
  font-size: var(--text-lg);  /* Base size for smallest containers */
  font-weight: var(--font-normal);
  line-height: var(--leading-snug);
  /* ... rest of existing styles ... */
}
```

**Step 3: Add container query rules for .fact-text**

Add these rules after the `.fact-text` rule:

```css
@container content (min-width: 500px) {
  .fact-text {
    font-size: var(--text-xl);
  }
}

@container content (min-width: 700px) {
  .fact-text {
    font-size: var(--text-2xl);
  }
}

@container content (min-width: 1000px) {
  .fact-text {
    font-size: var(--text-3xl);
  }
}

@container content (min-width: 1400px) {
  .fact-text {
    font-size: var(--text-4xl);
  }
}
```

**Step 4: Update metadata styles**

Replace `.metadata .title`:

```css
.metadata .title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  line-height: var(--leading-tight);
  /* ... rest unchanged ... */
}

@container content (min-width: 700px) {
  .metadata .title {
    font-size: var(--text-xl);
  }
}

@container content (min-width: 1000px) {
  .metadata .title {
    font-size: var(--text-2xl);
  }
}
```

Replace `.metadata .artist-album`:

```css
.metadata .artist-album {
  font-size: var(--text-base);
  font-weight: var(--font-normal);
  line-height: var(--leading-snug);
  /* ... rest unchanged ... */
}

@container content (min-width: 700px) {
  .metadata .artist-album {
    font-size: var(--text-lg);
  }
}

@container content (min-width: 1000px) {
  .metadata .artist-album {
    font-size: var(--text-xl);
  }
}
```

**Step 5: Update zone and secondary text**

Replace `.zone-indicator` font-size:

```css
.zone-indicator {
  font-size: var(--text-sm);
  /* ... rest unchanged ... */
}

@container content (min-width: 700px) {
  .zone-indicator {
    font-size: var(--text-base);
  }
}
```

Replace `.loading-hint`:

```css
.loading-hint {
  font-size: var(--text-base);
  /* ... rest unchanged ... */
}
```

Replace `.error-message`:

```css
.error-message {
  font-size: var(--text-sm);
  /* ... rest unchanged ... */
}
```

Replace `.no-playback-text`:

```css
.no-playback-text {
  font-size: var(--text-xl);
  /* ... rest unchanged ... */
}

@container content (min-width: 700px) {
  .no-playback-text {
    font-size: var(--text-2xl);
  }
}
```

Replace `.zone-hint`:

```css
.zone-hint {
  font-size: var(--text-base);
  /* ... rest unchanged ... */
}
```

**Step 6: Verify visually**

Run: `pnpm run dev`
Test these viewports:
- http://localhost:5174/?layout=facts-columns (resize window)
- Use browser DevTools to simulate iPad (834x1194)
- Simulate TV (1920x1080)

Verify: Text scales smoothly, no overflow issues

**Step 7: Commit**

```bash
git add packages/client/src/layouts/FactsColumnsLayout.vue
git commit -m "feat(FactsColumnsLayout): migrate to container query typography"
```

---

## Task 4: Run E2E Tests for FactsColumnsLayout

**Step 1: Run layout constraint tests**

```bash
pnpm test:e2e -- --grep "facts-columns"
```

Expected: All tests pass

**Step 2: Generate screenshots for visual comparison**

```bash
pnpm test:e2e:screenshots
```

Review screenshots in `e2e/screenshots/` for any visual regressions.

**Step 3: If tests fail, fix issues and re-test**

Common issues:
- Text overflow: reduce font sizes at breakpoints
- Too small: increase font sizes at breakpoints

---

## Task 5: Migrate FactsOverlayLayout

**Files:**
- Modify: `packages/client/src/layouts/FactsOverlayLayout.vue`

Follow same pattern as Task 2-3:
1. Add `container-type: inline-size` to root element
2. Remove old `--font-*` variables
3. Add token-based styles with container queries
4. Test visually
5. Commit: `git commit -m "feat(FactsOverlayLayout): migrate to container query typography"`

---

## Task 6: Migrate FactsCarouselLayout

**Files:**
- Modify: `packages/client/src/layouts/FactsCarouselLayout.vue`

Follow same pattern as Task 2-3.
Commit: `git commit -m "feat(FactsCarouselLayout): migrate to container query typography"`

---

## Task 7: Migrate DetailedLayout

**Files:**
- Modify: `packages/client/src/layouts/DetailedLayout.vue`

Follow same pattern as Task 2-3.
Commit: `git commit -m "feat(DetailedLayout): migrate to container query typography"`

---

## Task 8: Migrate AmbientLayout

**Files:**
- Modify: `packages/client/src/layouts/AmbientLayout.vue`

Follow same pattern as Task 2-3.
Commit: `git commit -m "feat(AmbientLayout): migrate to container query typography"`

---

## Task 9: Migrate MinimalLayout

**Files:**
- Modify: `packages/client/src/layouts/MinimalLayout.vue`

Follow same pattern as Task 2-3.
Commit: `git commit -m "feat(MinimalLayout): migrate to container query typography"`

---

## Task 10: Migrate Remaining Layouts

**Files:**
- Modify: `packages/client/src/layouts/CoverLayout.vue`
- Modify: `packages/client/src/layouts/FullscreenLayout.vue`
- Modify: `packages/client/src/layouts/BasicLayout.vue`

These layouts have minimal typography. Apply tokens where applicable.
Commit: `git commit -m "feat: migrate remaining layouts to typography tokens"`

---

## Task 11: Run Full E2E Suite

**Step 1: Run all E2E tests**

```bash
pnpm test:e2e
```

Expected: All tests pass across all viewport projects.

**Step 2: Generate full screenshot set**

```bash
pnpm test:e2e:screenshots
```

Review `e2e/screenshots/` for all layouts and viewports.

---

## Task 12: Cleanup

**Files:**
- Delete: `packages/client/src/views/TypographyTestView.vue`
- Modify: `packages/client/src/router.ts` (remove typography-test route)

**Step 1: Remove test view route**

In `router.ts`, remove:

```typescript
    {
      path: '/typography-test',
      name: 'typography-test',
      component: () => import('./views/TypographyTestView.vue'),
    },
```

**Step 2: Delete test view file**

```bash
rm packages/client/src/views/TypographyTestView.vue
```

**Step 3: Commit cleanup**

```bash
git add -A
git commit -m "chore: remove typography test page"
```

---

## Verification Checklist

After all tasks complete:

- [ ] `pnpm test:e2e` passes
- [ ] All layouts render correctly on iPad (834px)
- [ ] All layouts render correctly on 1080p TV (1920px)
- [ ] All layouts render correctly on 4K TV (3840px)
- [ ] No `clamp()` with `vw` units remain in layout files
- [ ] All layouts use tokens from `tokens.css`
