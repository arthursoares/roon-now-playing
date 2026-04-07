# Portrait Artwork Maximization & Layout Controls

**Date:** 2026-04-06
**Status:** Approved
**Triggered by:** Forum feedback (Lambert_Kou) on v1.7.3

## Problem Statement

1. **Ambient layout on iPad portrait** shows side-by-side (row) layout instead of stacked — the v1.7.3 portrait fix only applied to DetailedLayout
2. **Cover art is not maximized** in portrait/stacked mode for either Detailed or Ambient layouts — constrained by `max-height: 50vh` and `max-width: 45vh` respectively
3. **No user control over artwork size** — users want a Cover Art Scale slider (like Font Scale)
4. **No control over which layouts participate in cycling** — tapping cycles through all 9 layouts; users want to select a subset

## Scope

Three workstreams:
- **Bug fixes**: Ambient portrait layout + artwork maximization (CSS only)
- **Feature: Cover Art Scale** — global + per-screen override slider
- **Feature: Enabled Layouts** — per-screen checkbox selection for layout cycling

---

## 1. Bug Fixes — Portrait Layout

### 1a. Ambient Layout Portrait Fix

**File:** `packages/client/src/layouts/AmbientLayout.vue`

**Root cause:** Media query at line 299 uses `@media (min-width: 900px)` without an aspect ratio check. iPad Pro 12.9" in portrait has ~1024px CSS width, triggering the row layout.

**Fix:** Add `and (min-aspect-ratio: 1/1)` to both media queries (lines 299 and 317):

```css
/* Before */
@media (min-width: 900px) { ... }

/* After */
@media (min-width: 900px) and (min-aspect-ratio: 1/1) { ... }
```

This matches the approach used in DetailedLayout's v1.7.3 fix (commit f43e7a2).

### 1b. Cover Art Maximization in Portrait Stacked Mode

**DetailedLayout.vue:**
- `.artwork-container` currently has `max-height: 50vh` in stacked mode (line 183)
- Change to `max-height: 70vh` and let `--artwork-scale` CSS variable control the rest
- In portrait mode, artwork should fill available width by default

**AmbientLayout.vue:**
- `.artwork-column` currently has `max-width: 45vh` in stacked mode (line 315)
- Change to `max-width: 100%` so artwork fills the column width
- Let `--artwork-scale` control how much of that width is used

Both changes only affect the portrait/stacked code path. Landscape/side-by-side layout is unchanged.

---

## 2. Feature: Cover Art Scale

### Data Model

Follows the existing `fontScale` / `fontScaleOverride` pattern.

**Shared types (`packages/shared/src/index.ts`):**

```typescript
// Update DisplaySettings
export interface DisplaySettings {
  fontScale: number;
  artworkScale: number;  // NEW: 50-100 (percentage), default 100
}

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  fontScale: 1.0,
  artworkScale: 100,  // NEW
};

// Update ClientMetadata
export interface ClientMetadata {
  // ... existing fields ...
  artworkScaleOverride?: number | null;  // NEW: null = use global
}

// Update ServerRemoteSettingsMessage
export interface ServerRemoteSettingsMessage {
  // ... existing fields ...
  artworkScaleOverride?: number | null;  // NEW
}
```

### CSS Application

Applied as `--artwork-scale` CSS custom property (decimal 0.5–1.0) at the layout wrapper level in `NowPlayingView.vue`, alongside `--font-scale`.

Each layout uses it in portrait/stacked mode:

```css
.artwork-container {
  max-width: calc(100% * var(--artwork-scale, 1));
  align-self: center;
}
```

### Server API

**`POST /admin/display-settings`** — accepts `artworkScale` (number, 50–100):
- Validated: must be number, 50 <= value <= 100
- Stored in `config/display-settings.json`
- Broadcast to all clients via `display_settings_update`

**`POST /admin/clients/:clientId/push`** — accepts `artworkScaleOverride` (number 50–100, or null):
- Validated same range, or null to use global
- Pushed via `remote_settings` WebSocket message
- Stored on client connection state

### Admin Panel

**Global (AdminView.vue, Display section):**
- Slider labeled "Artwork Scale" next to Font Scale
- Range: 50–100%, step 5
- Displays current value as percentage

**Per-screen (ScreenConfigView.vue):**
- Section labeled "Artwork Scale" below Font Scale
- "Use global setting" checkbox (checked = null override)
- Slider appears when unchecked, same range/step

### Client Reception

`handleRemoteSettings()` in `NowPlayingView.vue`:
- Receives `artworkScaleOverride` from `remote_settings` message
- Stores in `currentArtworkScaleOverride` ref
- Applied as CSS variable: `--artwork-scale: ${(artworkScaleOverride ?? globalArtworkScale) / 100}`

---

## 3. Feature: Enabled Layouts

### Data Model

Per-screen only (no global setting).

**Shared types (`packages/shared/src/index.ts`):**

```typescript
// Update ClientMetadata
export interface ClientMetadata {
  // ... existing fields ...
  enabledLayouts?: LayoutType[] | null;  // NEW: null = all enabled
}

// Update ServerRemoteSettingsMessage
export interface ServerRemoteSettingsMessage {
  // ... existing fields ...
  enabledLayouts?: LayoutType[] | null;  // NEW
}
```

### Client Preferences

**`usePreferences.ts`:**
- New localStorage key: `roon-screen-cover:enabled-layouts`
- New ref: `enabledLayouts` (type `Ref<LayoutType[] | null>`)
- New function: `saveEnabledLayoutsPreference(layouts: LayoutType[] | null)`
- Loaded from localStorage on mount (no URL param support needed)
- Stored as JSON array, validated against `LAYOUTS`

### Cycling Logic

**`NowPlayingView.vue` — `cycleLayout()`:**

```typescript
function cycleLayout(): void {
  const enabled = enabledLayouts.value && enabledLayouts.value.length > 0
    ? enabledLayouts.value
    : [...LAYOUTS];
  const currentIndex = enabled.indexOf(layout.value);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % enabled.length;
  const newLayout = enabled[nextIndex];
  saveLayoutPreference(newLayout);
  updateMetadata();
}
```

If the current layout isn't in the enabled list (e.g., admin changed enabled set), jump to the first enabled layout.

### Admin Panel (ScreenConfigView.vue)

New section "Enabled Layouts" between Layout and Background pickers:

- Multi-select toggleable buttons using existing `option-grid` styling
- Active/selected state shows checkmark
- Prevent deselecting the last enabled layout (keep button disabled or ignore click)
- When all are selected (or none), equivalent to "all enabled" (null)

### Push Mechanism

- `POST /admin/clients/:clientId/push` accepts `enabledLayouts` (array of valid LayoutType values, or null)
- Server validates each entry against `LAYOUTS`
- Validates minimum 1 entry if array provided
- Pushed via `remote_settings` WebSocket message
- Client persists to localStorage on receipt

### Server State

- `enabledLayouts` added to connection state in `websocket.ts`
- Included in `getClientMetadata()` response
- Updated on push, same pattern as `fontScaleOverride`

---

## Files to Modify

### Shared Package
- `packages/shared/src/index.ts` — types: DisplaySettings, ClientMetadata, ServerRemoteSettingsMessage

### Server Package
- `packages/server/src/admin.ts` — validation for new push fields, display-settings endpoint
- `packages/server/src/websocket.ts` — connection state, push logic, metadata
- `packages/server/src/display-settings.ts` — no changes needed (generic JSON persistence)

### Client Package
- `packages/client/src/layouts/AmbientLayout.vue` — portrait fix + artwork-scale CSS
- `packages/client/src/layouts/DetailedLayout.vue` — artwork-scale CSS in portrait
- `packages/client/src/composables/usePreferences.ts` — enabledLayouts preference
- `packages/client/src/views/NowPlayingView.vue` — cycleLayout update, artwork-scale CSS var, handleRemoteSettings
- `packages/client/src/views/ScreenConfigView.vue` — artwork scale slider, enabled layouts checkboxes
- `packages/client/src/views/AdminView.vue` — global artwork scale slider
- `packages/client/src/composables/useWebSocket.ts` — pass enabledLayouts + artworkScaleOverride in remote_settings
- `packages/client/src/components/NowPlaying.vue` — no changes (props unchanged)

### Other Layouts (artwork-scale support)
Apply `--artwork-scale` to layouts that have sizeable artwork in stacked mode:
- `packages/client/src/layouts/CoverLayout.vue`
- `packages/client/src/layouts/BasicLayout.vue`
- `packages/client/src/layouts/FactsColumnsLayout.vue`

FullscreenLayout, MinimalLayout, FactsOverlayLayout, FactsCarouselLayout don't need artwork-scale (artwork is either always fullscreen or part of an overlay).

---

## Backwards Compatibility

- All new fields are optional with sensible defaults
- `artworkScale` defaults to 100 (fill width) — existing behavior becomes "maximized" as the user requested
- `enabledLayouts` defaults to null — all layouts cycle, matching current behavior
- No migration needed for existing `display-settings.json` files (spread with defaults handles it)
- No breaking changes to WebSocket protocol (new optional fields only)
