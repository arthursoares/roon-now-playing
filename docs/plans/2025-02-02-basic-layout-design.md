# Basic Layout Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a legacy-compatible "now playing" layout for older browsers (iOS 12 Safari) used as dedicated displays.

**Architecture:** Single Vue component with orientation-adaptive flexbox layout, avoiding modern CSS features.

**Tech Stack:** Vue 3, CSS (no modern features), existing ProgressBar component

---

## Overview

**Layout Name:** `basic`

**Purpose:** A now-playing layout optimized for older browsers (iOS 12 Safari) used as dedicated displays like old iPads or iPhones.

## Browser Constraints

Features to **avoid** for iOS 12 compatibility:

| Feature | Minimum iOS | Alternative |
|---------|-------------|-------------|
| CSS `gap` | 14.5 | Margins with lobotomized owl selector |
| CSS `aspect-ratio` | 15 | Padding-bottom hack |
| `backdrop-filter` | 13 (buggy) | Solid backgrounds only |
| CSS `clamp()` | 13.4 | Media queries |
| Complex CSS Grid | - | Simple flexbox |

## Features

**Included:**
- Album artwork with placeholder fallback
- Track title, artist, album
- Progress bar with current time / duration
- Auto-orientation (portrait ↔ landscape)

**Excluded:**
- Dynamic color extraction (except simple dominant color)
- Gradient backgrounds
- Blur effects
- Facts integration

## Supported Backgrounds

| Value | Behavior |
|-------|----------|
| `black` | `#000000` (default) |
| `white` | `#ffffff` |
| `dominant` | First color from simple palette extraction |
| Others | Fall back to `black` |

## Layout Structure

### Portrait Mode
```
┌─────────────────────────────────┐
│  ┌─────────────────────────┐    │
│  │                         │    │
│  │       Artwork           │    │
│  │       (square)          │    │
│  │                         │    │
│  └─────────────────────────┘    │
│                                 │
│  Title                          │
│  Artist                         │
│  Album                          │
│                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  0:00                    3:45   │
└─────────────────────────────────┘
```

### Landscape Mode
```
┌───────────────────────────────────────────────┐
│  ┌────────────┐                               │
│  │            │   Title                       │
│  │  Artwork   │   Artist                      │
│  │  (square)  │   Album                       │
│  │            │                               │
│  │            │   ━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  └────────────┘   0:00                 3:45   │
└───────────────────────────────────────────────┘
```

## CSS Strategy

```css
/* Spacing without gap */
.container > * + * {
  margin-top: 1rem;
}

/* Aspect ratio without aspect-ratio property */
.artwork-wrapper {
  position: relative;
  width: 100%;
  padding-bottom: 100%; /* 1:1 ratio */
}
.artwork {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  object-fit: cover;
}

/* Orientation handling */
@media (orientation: landscape) {
  .layout { flex-direction: row; }
}
@media (orientation: portrait) {
  .layout { flex-direction: column; }
}
```

## Integration Points

1. **Shared types:** Add `'basic'` to `LAYOUTS` array in `packages/shared/src/index.ts`

2. **NowPlaying.vue:** Import and register `BasicLayout` in the layout switcher

3. **ProgressBar.vue:** Reuse existing component (already compatible)

4. **Admin UI:** Automatically picks up new layout from `LAYOUTS` array

## Testing

- Safari Responsive Design Mode with iOS 12 user agent
- BrowserStack/LambdaTest for real iOS 12 device testing
- Verify: no CSS warnings, layout renders correctly, progress bar updates

## Files to Create/Modify

| File | Action |
|------|--------|
| `packages/client/src/layouts/BasicLayout.vue` | Create |
| `packages/shared/src/index.ts` | Add to LAYOUTS |
| `packages/client/src/components/NowPlaying.vue` | Register layout |
