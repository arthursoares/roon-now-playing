# Portrait Artwork & Layout Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix portrait layout bugs, add a Cover Art Scale slider (global + per-screen), and add per-screen layout cycling checkboxes.

**Architecture:** Extends existing settings infrastructure — `DisplaySettings` for global artwork scale, `ClientMetadata` / `ServerRemoteSettingsMessage` for per-screen overrides and enabled layouts. CSS custom property `--artwork-scale` mirrors the `--font-scale` pattern. Layout cycling filters against an enabled subset.

**Tech Stack:** Vue 3 + TypeScript, Express, WebSocket, localStorage

**Spec:** `docs/superpowers/specs/2026-04-06-portrait-artwork-and-layout-controls-design.md`

---

## File Structure

### Shared Package
- **Modify:** `packages/shared/src/index.ts` — Add `artworkScale` to `DisplaySettings`, `artworkScaleOverride` and `enabledLayouts` to `ClientMetadata` and `ServerRemoteSettingsMessage`

### Server Package
- **Modify:** `packages/server/src/websocket.ts` — Add `artworkScaleOverride` and `enabledLayouts` to `ClientState`, update `getClientMetadata()` and `pushSettingsToClient()`
- **Modify:** `packages/server/src/admin.ts` — Add validation for `artworkScaleOverride`, `enabledLayouts`, and `artworkScale` in display-settings

### Client Package
- **Modify:** `packages/client/src/layouts/AmbientLayout.vue` — Portrait fix (aspect-ratio media query) + `--artwork-scale` CSS
- **Modify:** `packages/client/src/layouts/DetailedLayout.vue` — Increase portrait artwork size + `--artwork-scale` CSS
- **Modify:** `packages/client/src/composables/usePreferences.ts` — Add `enabledLayouts` preference
- **Modify:** `packages/client/src/composables/useWebSocket.ts` — Pass `artworkScaleOverride` and `enabledLayouts` in `remote_settings` handler
- **Modify:** `packages/client/src/views/NowPlayingView.vue` — Apply `--artwork-scale` CSS var, update `cycleLayout()`, handle new remote settings
- **Modify:** `packages/client/src/views/ScreenConfigView.vue` — Add artwork scale slider and enabled layouts checkboxes
- **Modify:** `packages/client/src/views/AdminView.vue` — Add global artwork scale slider

---

## Task 1: Shared Types

**Files:**
- Modify: `packages/shared/src/index.ts:256-318`

- [ ] **Step 1: Add `artworkScale` to `DisplaySettings`**

In `packages/shared/src/index.ts`, update the `DisplaySettings` interface and default:

```typescript
// Display settings (stored on server)
export interface DisplaySettings {
  fontScale: number;
  artworkScale: number;
}

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  fontScale: 1.0,
  artworkScale: 100,
};
```

- [ ] **Step 2: Add new fields to `ClientMetadata`**

Add after the `fontScaleOverride` field:

```typescript
export interface ClientMetadata {
  clientId: string;
  friendlyName: string | null;
  layout: LayoutType;
  font: FontType;
  background: BackgroundType;
  zoneId: string | null;
  zoneName: string | null;
  connectedAt: number;
  userAgent: string | null;
  isAdmin: boolean;
  fontScaleOverride?: number | null;
  artworkScaleOverride?: number | null;
  enabledLayouts?: LayoutType[] | null;
}
```

- [ ] **Step 3: Add new fields to `ServerRemoteSettingsMessage`**

```typescript
export interface ServerRemoteSettingsMessage {
  type: 'remote_settings';
  layout?: LayoutType;
  font?: FontType;
  background?: BackgroundType;
  zoneId?: string;
  zoneName?: string;
  fontScaleOverride?: number | null;
  artworkScaleOverride?: number | null;
  enabledLayouts?: LayoutType[] | null;
}
```

- [ ] **Step 4: Build shared package to verify**

Run: `cd packages/shared && pnpm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): add artworkScale, artworkScaleOverride, and enabledLayouts types"
```

---

## Task 2: Server — WebSocket State & Push

**Files:**
- Modify: `packages/server/src/websocket.ts:29-43` (ClientState)
- Modify: `packages/server/src/websocket.ts:472-486` (getClientMetadata)
- Modify: `packages/server/src/websocket.ts:543-602` (pushSettingsToClient)

- [ ] **Step 1: Add fields to `ClientState` interface**

In `packages/server/src/websocket.ts`, update the `ClientState` interface (around line 29):

```typescript
interface ClientState {
  ws: WebSocket;
  clientId: string;
  deviceId: string;
  friendlyName: string | null;
  layout: LayoutType;
  font: FontType;
  background: BackgroundType;
  subscribedZoneId: string | null;
  subscribedZoneName: string | null;
  connectedAt: number;
  userAgent: string | null;
  isAdmin: boolean;
  fontScaleOverride?: number | null;
  artworkScaleOverride?: number | null;
  enabledLayouts?: LayoutType[] | null;
}
```

- [ ] **Step 2: Update `getClientMetadata()`**

Update the method (around line 472) to include the new fields:

```typescript
private getClientMetadata(clientState: ClientState): ClientMetadata {
  return {
    clientId: clientState.clientId,
    friendlyName: clientState.friendlyName,
    layout: clientState.layout,
    font: clientState.font,
    background: clientState.background,
    zoneId: clientState.subscribedZoneId,
    zoneName: clientState.subscribedZoneName,
    connectedAt: clientState.connectedAt,
    userAgent: clientState.userAgent,
    isAdmin: clientState.isAdmin,
    fontScaleOverride: clientState.fontScaleOverride,
    artworkScaleOverride: clientState.artworkScaleOverride,
    enabledLayouts: clientState.enabledLayouts,
  };
}
```

- [ ] **Step 3: Update `pushSettingsToClient()` signature and message**

Update the method signature (around line 543) to accept new fields:

```typescript
pushSettingsToClient(
  clientId: string,
  settings: {
    layout?: LayoutType;
    font?: FontType;
    background?: BackgroundType;
    zoneId?: string;
    fontScaleOverride?: number | null;
    artworkScaleOverride?: number | null;
    enabledLayouts?: LayoutType[] | null;
  }
): boolean {
```

Update the message construction inside the method:

```typescript
const message: ServerRemoteSettingsMessage = {
  type: 'remote_settings',
  layout: settings.layout,
  font: settings.font,
  background: settings.background,
  zoneId: settings.zoneId,
  zoneName,
  fontScaleOverride: settings.fontScaleOverride,
  artworkScaleOverride: settings.artworkScaleOverride,
  enabledLayouts: settings.enabledLayouts,
};
```

Update the connection state assignment in the `for (const conn of deviceConnections)` loop, adding after the `fontScaleOverride` block:

```typescript
if (settings.artworkScaleOverride !== undefined) {
  conn.artworkScaleOverride = settings.artworkScaleOverride;
}
if (settings.enabledLayouts !== undefined) {
  conn.enabledLayouts = settings.enabledLayouts;
}
```

- [ ] **Step 4: Build server package to verify**

Run: `cd packages/server && pnpm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/websocket.ts
git commit -m "feat(server): add artworkScaleOverride and enabledLayouts to WebSocket state and push"
```

---

## Task 3: Server — Admin API Validation

**Files:**
- Modify: `packages/server/src/admin.ts`

- [ ] **Step 1: Update the push endpoint validation**

In `packages/server/src/admin.ts`, update the destructuring in `POST /clients/:clientId/push` (around line 59):

```typescript
const { layout, font, background, zoneId, fontScaleOverride, artworkScaleOverride, enabledLayouts } = req.body as {
  layout?: LayoutType;
  font?: FontType;
  background?: BackgroundType;
  zoneId?: string;
  fontScaleOverride?: number | null;
  artworkScaleOverride?: number | null;
  enabledLayouts?: LayoutType[] | null;
};
```

Add validation for `artworkScaleOverride` after the `fontScaleOverride` validation block (around line 91):

```typescript
// Validate artworkScaleOverride
if (artworkScaleOverride !== undefined && artworkScaleOverride !== null) {
  if (typeof artworkScaleOverride !== 'number' || artworkScaleOverride < 50 || artworkScaleOverride > 100) {
    res.status(400).json({ error: 'artworkScaleOverride must be a number between 50 and 100, or null' });
    return;
  }
}

// Validate enabledLayouts
if (enabledLayouts !== undefined && enabledLayouts !== null) {
  if (!Array.isArray(enabledLayouts) || enabledLayouts.length === 0) {
    res.status(400).json({ error: 'enabledLayouts must be a non-empty array of layout types, or null' });
    return;
  }
  for (const l of enabledLayouts) {
    if (!(LAYOUTS as readonly string[]).includes(l)) {
      res.status(400).json({ error: `Invalid layout in enabledLayouts: ${l}. Must be one of: ${LAYOUTS.join(', ')}` });
      return;
    }
  }
}
```

Update the "no settings provided" check (around line 94):

```typescript
if (layout === undefined && font === undefined && background === undefined && zoneId === undefined && fontScaleOverride === undefined && artworkScaleOverride === undefined && enabledLayouts === undefined) {
  res.status(400).json({ error: 'At least one setting is required' });
  return;
}
```

Update the `pushSettingsToClient` call:

```typescript
const success = wsManager.pushSettingsToClient(clientId, { layout, font, background, zoneId, fontScaleOverride, artworkScaleOverride, enabledLayouts });
```

- [ ] **Step 2: Update the display-settings endpoint**

Update `POST /display-settings` to handle `artworkScale` (around line 128):

```typescript
router.post('/display-settings', (req, res) => {
  const { fontScale, artworkScale } = req.body;
  const settings = loadDisplaySettings();

  if (typeof fontScale === 'number' && fontScale >= 0.75 && fontScale <= 1.5) {
    settings.fontScale = fontScale;
  }

  if (typeof artworkScale === 'number' && artworkScale >= 50 && artworkScale <= 100) {
    settings.artworkScale = artworkScale;
  }

  saveDisplaySettings(settings);
  wsManager.broadcastDisplaySettings(settings);
  res.json(settings);
});
```

- [ ] **Step 3: Build server package to verify**

Run: `cd packages/server && pnpm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/admin.ts
git commit -m "feat(server): add artworkScaleOverride, enabledLayouts, and artworkScale validation to admin API"
```

---

## Task 4: Bug Fix — Ambient Layout Portrait

**Files:**
- Modify: `packages/client/src/layouts/AmbientLayout.vue:299-323`

- [ ] **Step 1: Add `min-aspect-ratio` to content media query**

In `AmbientLayout.vue`, change the media query at line 299 from:

```css
@media (min-width: 900px) {
  .content {
    flex-direction: row;
    align-items: center;
    gap: 5%;
  }
}
```

to:

```css
@media (min-width: 900px) and (min-aspect-ratio: 1/1) {
  .content {
    flex-direction: row;
    align-items: center;
    gap: 5%;
  }
}
```

- [ ] **Step 2: Add `min-aspect-ratio` to artwork-column media query**

Change the media query at line 317 from:

```css
@media (min-width: 900px) {
  .artwork-column {
    width: 55%;
    max-width: none;
    flex: 0 0 55%;
  }
}
```

to:

```css
@media (min-width: 900px) and (min-aspect-ratio: 1/1) {
  .artwork-column {
    width: 55%;
    max-width: none;
    flex: 0 0 55%;
  }
}
```

- [ ] **Step 3: Add `min-aspect-ratio` to metadata-column media query**

Change the media query at line 391 from:

```css
@media (min-width: 900px) {
  .metadata-column {
    flex: 0 0 40%;
  }
}
```

to:

```css
@media (min-width: 900px) and (min-aspect-ratio: 1/1) {
  .metadata-column {
    flex: 0 0 40%;
  }
}
```

- [ ] **Step 4: Maximize artwork in portrait stacked mode**

Change the `.artwork-column` base styles (around line 308) from:

```css
.artwork-column {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 45vh;
}
```

to:

```css
.artwork-column {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: calc(100% * var(--artwork-scale, 1));
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/layouts/AmbientLayout.vue
git commit -m "fix(AmbientLayout): use stacked layout for tablets in portrait mode and apply artwork scale"
```

---

## Task 5: Bug Fix — Detailed Layout Portrait Artwork Size

**Files:**
- Modify: `packages/client/src/layouts/DetailedLayout.vue:179-193`

- [ ] **Step 1: Update artwork container for portrait mode**

In `DetailedLayout.vue`, change the `.artwork-container` base styles (around line 179) from:

```css
.artwork-container {
  flex-shrink: 0;
  aspect-ratio: 1;
  max-height: 50vh;
  align-self: center;
}
```

to:

```css
.artwork-container {
  flex-shrink: 0;
  aspect-ratio: 1;
  max-height: 70vh;
  max-width: calc(100% * var(--artwork-scale, 1));
  align-self: center;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/layouts/DetailedLayout.vue
git commit -m "fix(DetailedLayout): increase portrait artwork size and apply artwork scale"
```

---

## Task 6: Client Preferences — Enabled Layouts

**Files:**
- Modify: `packages/client/src/composables/usePreferences.ts`

- [ ] **Step 1: Add enabled layouts storage key and helpers**

Add after the existing storage key constants (around line 7):

```typescript
const STORAGE_KEY_ENABLED_LAYOUTS = 'roon-screen-cover:enabled-layouts';
```

Add a validation function after `isValidBackground`:

```typescript
function isValidEnabledLayouts(value: string | null): LayoutType[] | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const valid = parsed.filter((l: string) => (LAYOUTS as readonly string[]).includes(l)) as LayoutType[];
    return valid.length > 0 ? valid : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Add enabled layouts ref and functions**

In the `usePreferences()` function, add the new ref after the `background` ref:

```typescript
const enabledLayouts = ref<LayoutType[] | null>(null);
```

In `loadPreferences()`, add at the end:

```typescript
// Enabled layouts: localStorage only (no URL param)
const storedLayouts = localStorage.getItem(STORAGE_KEY_ENABLED_LAYOUTS);
enabledLayouts.value = isValidEnabledLayouts(storedLayouts);
```

Add the save function after `clearZonePreference()`:

```typescript
function saveEnabledLayoutsPreference(layouts: LayoutType[] | null): void {
  enabledLayouts.value = layouts;
  if (layouts && layouts.length > 0) {
    localStorage.setItem(STORAGE_KEY_ENABLED_LAYOUTS, JSON.stringify(layouts));
  } else {
    localStorage.removeItem(STORAGE_KEY_ENABLED_LAYOUTS);
  }
}
```

- [ ] **Step 3: Export the new ref and function**

Update the return object to include:

```typescript
return {
  preferredZone,
  layout,
  font,
  background,
  enabledLayouts,
  saveZonePreference,
  saveLayoutPreference,
  saveFontPreference,
  saveBackgroundPreference,
  clearZonePreference,
  saveEnabledLayoutsPreference,
  loadPreferences,
};
```

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/composables/usePreferences.ts
git commit -m "feat(preferences): add enabledLayouts preference with localStorage persistence"
```

---

## Task 7: NowPlayingView — Artwork Scale CSS + Cycle Logic + Remote Settings

**Files:**
- Modify: `packages/client/src/views/NowPlayingView.vue`

- [ ] **Step 1: Destructure new preferences**

Update the `usePreferences()` destructuring (around line 10) to include `enabledLayouts` and `saveEnabledLayoutsPreference`:

```typescript
const {
  preferredZone,
  layout,
  font,
  background,
  enabledLayouts,
  saveZonePreference,
  saveLayoutPreference,
  saveFontPreference,
  saveBackgroundPreference,
  clearZonePreference,
  saveEnabledLayoutsPreference,
  loadPreferences,
} = usePreferences();
```

- [ ] **Step 2: Add artwork scale override ref**

Add after `currentFontScaleOverride` ref (around line 25):

```typescript
const currentArtworkScaleOverride = ref<number | null>(null);
```

- [ ] **Step 3: Update `handleRemoteSettings`**

Add handling for the new fields inside `handleRemoteSettings()`, after the `fontScaleOverride` block:

```typescript
if (settings.artworkScaleOverride !== undefined) {
  currentArtworkScaleOverride.value = settings.artworkScaleOverride;
}
if (settings.enabledLayouts !== undefined) {
  saveEnabledLayoutsPreference(settings.enabledLayouts);
}
```

Also update the function's type signature to include the new fields:

```typescript
function handleRemoteSettings(settings: {
  layout?: LayoutType;
  font?: FontType;
  background?: BackgroundType;
  fontScaleOverride?: number | null;
  artworkScaleOverride?: number | null;
  enabledLayouts?: LayoutType[] | null;
  zoneId?: string;
  zoneName?: string;
}) {
```

- [ ] **Step 4: Add artwork scale CSS variable watcher**

Add after the font scale watcher (around line 178):

```typescript
// Apply artwork scale override with priority over global setting
watch(
  [() => wsState.value.displaySettings?.artworkScale, currentArtworkScaleOverride],
  ([globalScale, override]) => {
    const effectiveScale = override !== null ? override : (globalScale || 100);
    document.documentElement.style.setProperty('--artwork-scale', String(effectiveScale / 100));
  },
  { immediate: true }
);
```

- [ ] **Step 5: Update `cycleLayout()` to use enabled layouts**

Replace the existing `cycleLayout()` function:

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

- [ ] **Step 6: Build client to verify**

Run: `cd packages/client && pnpm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/views/NowPlayingView.vue
git commit -m "feat(NowPlayingView): add artwork scale CSS var, enabled layouts cycling, and remote settings"
```

---

## Task 8: WebSocket Composable — Pass New Remote Settings Fields

**Files:**
- Modify: `packages/client/src/composables/useWebSocket.ts:213-225`

- [ ] **Step 1: Update `remote_settings` handler**

In the `remote_settings` case (around line 213), update the `onRemoteSettings` call to include the new fields:

```typescript
case 'remote_settings':
  console.log('[WS] Received remote settings:', message);
  if (options.onRemoteSettings) {
    options.onRemoteSettings({
      layout: message.layout,
      font: message.font,
      background: message.background,
      fontScaleOverride: message.fontScaleOverride,
      artworkScaleOverride: message.artworkScaleOverride,
      enabledLayouts: message.enabledLayouts,
      zoneId: message.zoneId,
      zoneName: message.zoneName,
    });
  }
  break;
```

- [ ] **Step 2: Update the `displaySettings` default in state**

Update the initial state (around line 70) to include `artworkScale`:

```typescript
displaySettings: { fontScale: 1, artworkScale: 100 },
```

- [ ] **Step 3: Build client to verify**

Run: `cd packages/client && pnpm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/composables/useWebSocket.ts
git commit -m "feat(useWebSocket): pass artworkScaleOverride and enabledLayouts from remote settings"
```

---

## Task 9: Admin Panel — Global Artwork Scale Slider

**Files:**
- Modify: `packages/client/src/views/AdminView.vue`

- [ ] **Step 1: Update display settings ref type**

Change the `displaySettings` ref (around line 83) from:

```typescript
const displaySettings = ref<{ fontScale: number }>({ fontScale: 1 });
```

to:

```typescript
const displaySettings = ref<{ fontScale: number; artworkScale: number }>({ fontScale: 1, artworkScale: 100 });
```

- [ ] **Step 2: Add artwork scale change handler**

Add after `onFontScaleChange` function (around line 110):

```typescript
function onArtworkScaleChange(event: Event): void {
  const value = parseInt((event.target as HTMLInputElement).value, 10);
  displaySettings.value.artworkScale = value;

  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => saveDisplaySettings(), 300);
}
```

- [ ] **Step 3: Add artwork scale slider to template**

In the template, add a new config card after the Font Scale card's closing `</div>` (after line 1226):

```html
<div class="config-card">
  <h2 class="card-title">Artwork Scale</h2>
  <p class="card-desc">Adjust the global artwork size in portrait/stacked layouts. Individual screens can override this setting.</p>

  <div class="slider-field">
    <div class="slider-header">
      <label for="artworkScale">Scale</label>
      <span class="slider-value">{{ displaySettings.artworkScale }}%</span>
    </div>
    <input
      id="artworkScale"
      type="range"
      min="50"
      max="100"
      step="5"
      :value="displaySettings.artworkScale"
      @input="onArtworkScaleChange"
      class="slider-input"
    />
    <div class="slider-labels">
      <span>50%</span>
      <span>75%</span>
      <span>100%</span>
    </div>
  </div>

  <div v-if="displaySettingsSaving" class="saving-indicator">
    Saving...
  </div>
</div>
```

- [ ] **Step 4: Build client to verify**

Run: `cd packages/client && pnpm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/views/AdminView.vue
git commit -m "feat(admin): add global Artwork Scale slider to Display Settings"
```

---

## Task 10: Screen Config — Artwork Scale Override + Enabled Layouts

**Files:**
- Modify: `packages/client/src/views/ScreenConfigView.vue`

- [ ] **Step 1: Add artwork scale override handlers**

In the `<script setup>` section, add after the `onFontScaleOverrideChange` function (around line 115):

```typescript
function toggleArtworkScaleOverride(event: Event): void {
  const useGlobal = (event.target as HTMLInputElement).checked;
  pushSetting({ artworkScaleOverride: useGlobal ? null : 100 });
}

let artworkScaleTimeout: ReturnType<typeof setTimeout> | null = null;

function onArtworkScaleOverrideChange(event: Event): void {
  const value = parseInt((event.target as HTMLInputElement).value, 10);
  if (artworkScaleTimeout) clearTimeout(artworkScaleTimeout);
  artworkScaleTimeout = setTimeout(() => {
    pushSetting({ artworkScaleOverride: value });
  }, 300);
}
```

- [ ] **Step 2: Add enabled layouts toggle handler**

Add after the artwork scale handlers:

```typescript
function toggleLayout(layoutName: LayoutType): void {
  const current = screen.value?.enabledLayouts ?? [...LAYOUTS];
  const index = current.indexOf(layoutName);

  if (index > -1) {
    // Don't allow deselecting the last one
    if (current.length <= 1) return;
    const updated = current.filter((l) => l !== layoutName);
    pushSetting({ enabledLayouts: updated });
  } else {
    const updated = [...current, layoutName];
    // If all layouts are now selected, send null (means "all")
    if (updated.length === LAYOUTS.length) {
      pushSetting({ enabledLayouts: null });
    } else {
      pushSetting({ enabledLayouts: updated });
    }
  }
}

function isLayoutEnabled(layoutName: LayoutType): boolean {
  const enabled = screen.value?.enabledLayouts;
  if (!enabled) return true; // null = all enabled
  return enabled.includes(layoutName);
}

function selectAllLayouts(): void {
  pushSetting({ enabledLayouts: null });
}
```

- [ ] **Step 3: Update `pushSetting` signature**

Update the `pushSetting` function parameter type (around line 78) to include the new fields:

```typescript
async function pushSetting(
  setting: {
    layout?: LayoutType;
    font?: FontType;
    background?: BackgroundType;
    zoneId?: string;
    fontScaleOverride?: number | null;
    artworkScaleOverride?: number | null;
    enabledLayouts?: LayoutType[] | null;
  }
): Promise<void> {
```

- [ ] **Step 4: Add Artwork Scale section to template**

Add after the Font Scale section's closing `</section>` (after line 273):

```html
<!-- Artwork Scale Override -->
<section class="config-section">
  <label class="config-label">Artwork Scale</label>

  <div class="override-toggle">
    <label class="checkbox-label">
      <input
        type="checkbox"
        :checked="screen.artworkScaleOverride === null || screen.artworkScaleOverride === undefined"
        @change="toggleArtworkScaleOverride"
      />
      Use global setting
    </label>
  </div>

  <div v-if="screen.artworkScaleOverride !== null && screen.artworkScaleOverride !== undefined" class="slider-compact">
    <input
      type="range"
      min="50"
      max="100"
      step="5"
      :value="screen.artworkScaleOverride"
      @input="onArtworkScaleOverrideChange"
    />
    <span class="slider-value">{{ screen.artworkScaleOverride ?? 100 }}%</span>
  </div>
</section>
```

- [ ] **Step 5: Add Enabled Layouts section to template**

Add after the Artwork Scale section:

```html
<!-- Enabled Layouts for Cycling -->
<section class="config-section">
  <label class="config-label">Layouts for Cycling</label>
  <p class="config-hint">Select which layouts to cycle through when tapping the screen.</p>
  <div class="option-grid">
    <button
      v-for="l in LAYOUTS"
      :key="l"
      class="option-btn"
      :class="{ active: isLayoutEnabled(l) }"
      @click="toggleLayout(l)"
    >
      {{ getLayoutDisplayName(l) }}
    </button>
  </div>
  <button
    class="btn btn-small btn-ghost"
    style="margin-top: 0.5rem"
    @click="selectAllLayouts"
  >
    Select All
  </button>
</section>
```

- [ ] **Step 6: Add `.config-hint` style**

In the `<style scoped>` section, add:

```css
.config-hint {
  font-size: 0.8rem;
  color: #666;
  margin: 0 0 0.75rem 0;
}
```

- [ ] **Step 7: Build client to verify**

Run: `cd packages/client && pnpm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/client/src/views/ScreenConfigView.vue
git commit -m "feat(ScreenConfig): add artwork scale override slider and enabled layouts checkboxes"
```

---

## Task 11: Full Build & Manual Verification

- [ ] **Step 1: Full build**

Run: `pnpm run build`
Expected: All three packages build successfully.

- [ ] **Step 2: Verify no TypeScript errors**

Run: `cd packages/client && npx vue-tsc --noEmit 2>&1 | head -30`
Expected: No errors (or pre-existing errors only).

- [ ] **Step 3: Commit any remaining fixes**

If any build issues were found, fix and commit them.

- [ ] **Step 4: Final commit with all changes**

If all tasks were committed individually, no action needed. Otherwise:

```bash
git add -A
git commit -m "feat: portrait artwork fixes, artwork scale slider, and layout cycling controls"
```
