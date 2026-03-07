# Font Scale UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add UI controls for global and per-screen font scale adjustment with live WebSocket preview.

**Architecture:** Extend the existing typography tokens system with a `--font-scale` multiplier. Admin panel gets a new Display Settings section; per-screen config adds an override option. Server stores global config and broadcasts changes via WebSocket.

**Tech Stack:** Vue 3 Composition API, CSS Custom Properties, WebSocket, Express REST API

---

## Task 1: Add Font Scale to Typography Tokens

**Files:**
- Modify: `packages/client/src/styles/tokens.css`

**Step 1: Add font-scale variable to tokens.css**

Add to the `:root` section:

```css
:root {
  /* Font Scale Multiplier - adjusted via admin UI */
  --font-scale: 1;

  /* ... existing tokens ... */
}
```

**Step 2: Verify tokens still load**

Run: `pnpm run dev`
Open: http://localhost:5174/
Verify: Page renders normally

**Step 3: Commit**

```bash
git add packages/client/src/styles/tokens.css
git commit -m "feat(tokens): add --font-scale CSS variable"
```

---

## Task 2: Create Display Settings Types in Shared Package

**Files:**
- Modify: `packages/shared/src/index.ts`

**Step 1: Add DisplaySettings interface**

Add to shared types:

```typescript
/** Global display settings stored on server */
export interface DisplaySettings {
  fontScale: number;
}

/** Default display settings */
export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  fontScale: 1.0,
};
```

**Step 2: Add display_settings_update message type**

Find the existing message type definitions and add:

```typescript
/** WebSocket message for display settings changes */
export interface DisplaySettingsUpdateMessage {
  type: 'display_settings_update';
  settings: DisplaySettings;
}
```

**Step 3: Rebuild shared package**

Run: `pnpm run build:shared`
Verify: No TypeScript errors

**Step 4: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): add DisplaySettings types and message"
```

---

## Task 3: Add Server Display Settings Storage and API

**Files:**
- Create: `packages/server/src/display-settings.ts`
- Modify: `packages/server/src/admin.ts`

**Step 1: Create display settings module**

Create `packages/server/src/display-settings.ts`:

```typescript
import fs from 'fs';
import path from 'path';
import { DisplaySettings, DEFAULT_DISPLAY_SETTINGS } from '@roon-screen-cover/shared';

const CONFIG_DIR = path.join(process.cwd(), 'config');
const SETTINGS_FILE = path.join(CONFIG_DIR, 'display-settings.json');

export function loadDisplaySettings(): DisplaySettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      return { ...DEFAULT_DISPLAY_SETTINGS, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error('Failed to load display settings:', err);
  }
  return { ...DEFAULT_DISPLAY_SETTINGS };
}

export function saveDisplaySettings(settings: DisplaySettings): void {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error('Failed to save display settings:', err);
  }
}
```

**Step 2: Add API endpoints to admin.ts**

Add to admin router:

```typescript
import { loadDisplaySettings, saveDisplaySettings } from './display-settings';

// Get display settings
router.get('/display-settings', (_req, res) => {
  const settings = loadDisplaySettings();
  res.json(settings);
});

// Update display settings
router.post('/display-settings', (req, res) => {
  const { fontScale } = req.body;
  const settings = loadDisplaySettings();

  if (typeof fontScale === 'number' && fontScale >= 0.75 && fontScale <= 1.5) {
    settings.fontScale = fontScale;
  }

  saveDisplaySettings(settings);

  // TODO: Broadcast to clients via WebSocket (Task 5)

  res.json(settings);
});
```

**Step 3: Build and test API**

Run: `pnpm run build && pnpm run dev`
Test: `curl http://localhost:3000/api/admin/display-settings`
Expected: `{"fontScale":1}`

**Step 4: Commit**

```bash
git add packages/server/src/display-settings.ts packages/server/src/admin.ts
git commit -m "feat(server): add display settings storage and API"
```

---

## Task 4: Add Display Settings Section to Admin Panel

**Files:**
- Modify: `packages/client/src/views/AdminView.vue`

**Step 1: Add display settings state**

Add to script setup:

```typescript
// Display settings state
const displaySettings = ref<{ fontScale: number }>({ fontScale: 1 });
const displaySettingsLoading = ref(true);
const displaySettingsSaving = ref(false);

async function loadDisplaySettings(): Promise<void> {
  try {
    displaySettingsLoading.value = true;
    const response = await fetch('/api/admin/display-settings');
    if (response.ok) {
      displaySettings.value = await response.json();
    }
  } catch (error) {
    console.error('Failed to load display settings:', error);
  } finally {
    displaySettingsLoading.value = false;
  }
}

// Debounced save
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function onFontScaleChange(event: Event): void {
  const value = parseFloat((event.target as HTMLInputElement).value);
  displaySettings.value.fontScale = value;

  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => saveDisplaySettings(), 300);
}

async function saveDisplaySettings(): Promise<void> {
  displaySettingsSaving.value = true;
  try {
    await fetch('/api/admin/display-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(displaySettings.value),
    });
  } catch (error) {
    console.error('Failed to save display settings:', error);
  } finally {
    displaySettingsSaving.value = false;
  }
}
```

**Step 2: Add to onMounted**

Update onMounted:

```typescript
onMounted(() => {
  loadFactsConfig();
  loadSourcesData();
  loadDisplaySettings();
});
```

**Step 3: Add display navigation item**

Add after the "Sources" nav item:

```html
<button
  class="nav-item"
  :class="{ active: activeSection === 'display' }"
  @click="activeSection = 'display'"
>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
  <span>Display</span>
</button>
```

**Step 4: Update activeSection type**

Update the type:

```typescript
const activeSection = ref<'clients' | 'facts' | 'test' | 'sources' | 'display'>('clients');
```

**Step 5: Add Display Settings section template**

Add after the Sources section:

```html
<!-- Display Settings Section -->
<section v-if="activeSection === 'display'" class="content-section">
  <header class="section-header">
    <div class="section-title">
      <h1>Display Settings</h1>
      <p class="section-desc">Adjust global display appearance settings.</p>
    </div>
  </header>

  <div v-if="displaySettingsLoading" class="loading-state">
    <div class="loading-spinner"></div>
    <span>Loading settings...</span>
  </div>

  <div v-else class="config-card">
    <h2 class="card-title">Font Scale</h2>
    <p class="card-desc">Adjust the global font size multiplier. Individual screens can override this setting.</p>

    <div class="slider-field">
      <div class="slider-header">
        <label for="fontScale">Scale Factor</label>
        <span class="slider-value">{{ displaySettings.fontScale.toFixed(2) }}x</span>
      </div>
      <input
        id="fontScale"
        type="range"
        min="0.75"
        max="1.5"
        step="0.05"
        :value="displaySettings.fontScale"
        @input="onFontScaleChange"
        class="slider-input"
      />
      <div class="slider-labels">
        <span>0.75x</span>
        <span>1.0x</span>
        <span>1.5x</span>
      </div>
    </div>

    <div v-if="displaySettingsSaving" class="saving-indicator">
      Saving...
    </div>
  </div>
</section>
```

**Step 6: Add slider styles**

Add to the scoped styles:

```css
/* === Slider Styles === */
.card-desc {
  margin: 0 0 24px 0;
  color: var(--text-muted);
  font-size: 14px;
}

.slider-field {
  max-width: 400px;
}

.slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.slider-header label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.slider-value {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 600;
  color: var(--accent-primary);
  min-width: 48px;
  text-align: right;
}

.slider-input {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--bg-surface);
  border-radius: 3px;
  outline: none;
}

.slider-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  background: var(--accent-primary);
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.15s;
}

.slider-input::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}

.slider-input::-moz-range-thumb {
  width: 20px;
  height: 20px;
  background: var(--accent-primary);
  border: none;
  border-radius: 50%;
  cursor: pointer;
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 11px;
  color: var(--text-muted);
}

.saving-indicator {
  margin-top: 16px;
  font-size: 12px;
  color: var(--text-muted);
}
```

**Step 7: Verify UI**

Run: `pnpm run dev`
Open: http://localhost:5174/admin
Click: "Display" nav item
Verify: Slider appears and changes value, saves on change

**Step 8: Commit**

```bash
git add packages/client/src/views/AdminView.vue
git commit -m "feat(admin): add Display Settings section with font scale slider"
```

---

## Task 5: Broadcast Display Settings via WebSocket

**Files:**
- Modify: `packages/server/src/websocket.ts`
- Modify: `packages/server/src/admin.ts`

**Step 1: Add broadcast function to websocket module**

In websocket.ts, export a broadcast function for display settings:

```typescript
import { DisplaySettings } from '@roon-screen-cover/shared';

export function broadcastDisplaySettings(settings: DisplaySettings): void {
  const message = JSON.stringify({
    type: 'display_settings_update',
    settings,
  });

  // Broadcast to all non-admin clients
  clients.forEach((client) => {
    if (!client.isAdmin && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  });
}
```

**Step 2: Call broadcast from admin.ts**

Update the POST /display-settings handler:

```typescript
import { broadcastDisplaySettings } from './websocket';

// In the POST handler, after saveDisplaySettings:
broadcastDisplaySettings(settings);
```

**Step 3: Verify broadcast**

Run: `pnpm run dev`
Open: Two browser tabs - one /admin, one /
Change: Font scale in admin
Verify: Message logged in browser console (we'll handle it in next task)

**Step 4: Commit**

```bash
git add packages/server/src/websocket.ts packages/server/src/admin.ts
git commit -m "feat(server): broadcast display settings changes via WebSocket"
```

---

## Task 6: Apply Font Scale on Client

**Files:**
- Modify: `packages/client/src/composables/useWebSocket.ts`
- Modify: `packages/client/src/App.vue`

**Step 1: Handle display_settings_update in useWebSocket**

Add to the websocket composable:

```typescript
// Add to state interface
displaySettings: { fontScale: number };

// Add to initial state
displaySettings: { fontScale: 1 },

// Add message handler
case 'display_settings_update':
  state.value.displaySettings = message.settings;
  break;
```

**Step 2: Apply CSS variable in App.vue**

Add a watcher to apply the font scale:

```typescript
import { watch } from 'vue';
import { useWebSocket } from './composables/useWebSocket';

const { state } = useWebSocket();

watch(
  () => state.value.displaySettings?.fontScale,
  (scale) => {
    if (scale) {
      document.documentElement.style.setProperty('--font-scale', String(scale));
    }
  },
  { immediate: true }
);
```

**Step 3: Update layouts to use font-scale**

In each layout file, update font-size declarations to multiply by --font-scale:

Example for `.fact-text`:
```css
.fact-text {
  font-size: calc(var(--text-lg) * var(--font-scale, 1));
  /* ... */
}
```

**Note:** This should be done for key text elements. Start with FactsColumnsLayout.vue as the primary test.

**Step 4: Test live preview**

Run: `pnpm run dev`
Open: / in one tab, /admin in another
Change: Font scale slider
Verify: Text on main page updates in real-time

**Step 5: Commit**

```bash
git add packages/client/src/composables/useWebSocket.ts packages/client/src/App.vue packages/client/src/layouts/FactsColumnsLayout.vue
git commit -m "feat(client): apply font scale from WebSocket in real-time"
```

---

## Task 7: Add Per-Screen Font Scale Override

**Files:**
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/client/src/views/ScreenConfigView.vue`
- Modify: `packages/server/src/admin.ts`

**Step 1: Add fontScaleOverride to ClientMetadata**

In shared/index.ts, add to ClientMetadata:

```typescript
export interface ClientMetadata {
  // ... existing fields ...
  fontScaleOverride?: number | null; // null = use global, number = custom
}
```

**Step 2: Add override UI to ScreenConfigView**

Add after the Font picker section:

```html
<!-- Font Scale Override -->
<section class="config-section">
  <label class="config-label">Font Scale</label>

  <div class="override-toggle">
    <label class="checkbox-label">
      <input
        type="checkbox"
        :checked="screen.fontScaleOverride === null || screen.fontScaleOverride === undefined"
        @change="toggleFontScaleOverride"
      />
      Use global setting
    </label>
  </div>

  <div v-if="screen.fontScaleOverride !== null && screen.fontScaleOverride !== undefined" class="slider-compact">
    <input
      type="range"
      min="0.75"
      max="1.5"
      step="0.05"
      :value="screen.fontScaleOverride"
      @input="onFontScaleOverrideChange"
    />
    <span class="slider-value">{{ screen.fontScaleOverride?.toFixed(2) || '1.00' }}x</span>
  </div>
</section>
```

**Step 3: Add handler functions**

```typescript
function toggleFontScaleOverride(event: Event): void {
  const useGlobal = (event.target as HTMLInputElement).checked;
  pushSetting({ fontScaleOverride: useGlobal ? null : 1.0 });
}

let fontScaleTimeout: ReturnType<typeof setTimeout> | null = null;

function onFontScaleOverrideChange(event: Event): void {
  const value = parseFloat((event.target as HTMLInputElement).value);
  if (fontScaleTimeout) clearTimeout(fontScaleTimeout);
  fontScaleTimeout = setTimeout(() => {
    pushSetting({ fontScaleOverride: value });
  }, 300);
}
```

**Step 4: Update pushSetting signature**

Update to include fontScaleOverride:

```typescript
async function pushSetting(
  setting: {
    layout?: LayoutType;
    font?: FontType;
    background?: BackgroundType;
    zoneId?: string;
    fontScaleOverride?: number | null;
  }
): Promise<void> {
  // ... existing implementation ...
}
```

**Step 5: Add styles**

```css
.override-toggle {
  margin-bottom: 1rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  color: #ccc;
}

.checkbox-label input {
  width: 16px;
  height: 16px;
}

.slider-compact {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.slider-compact input[type="range"] {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  background: #333;
  border-radius: 2px;
}

.slider-compact input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  background: #4a6cf7;
  border-radius: 50%;
  cursor: pointer;
}

.slider-compact .slider-value {
  font-family: monospace;
  font-size: 0.9rem;
  color: #888;
  min-width: 48px;
}
```

**Step 6: Update server to handle fontScaleOverride**

In admin.ts push endpoint, handle the new field:

```typescript
// In the /clients/:clientId/push handler
if ('fontScaleOverride' in req.body) {
  // Store and push to client
  // ... implementation depends on existing push logic
}
```

**Step 7: Test**

Run: `pnpm run dev`
Open: /admin/screen/TestScreen
Toggle: "Use global setting" checkbox
Adjust: Slider when using custom
Verify: Changes push to client

**Step 8: Commit**

```bash
git add packages/shared/src/index.ts packages/client/src/views/ScreenConfigView.vue packages/server/src/admin.ts
git commit -m "feat: add per-screen font scale override"
```

---

## Task 8: Fix Admin Panel Input Box Layout Issues

**Files:**
- Modify: `packages/client/src/views/AdminView.vue`

**Step 1: Identify layout issues**

Review the form inputs in AdminView.vue. Known issues:
- Number inputs may overflow on narrow containers
- Custom model input in OpenRouter may not have proper spacing
- Form grid may break at certain widths

**Step 2: Fix number input overflow**

Update `.number-input` styles:

```css
.number-input {
  display: flex;
  align-items: center;
  gap: 8px;
}

.number-input input {
  width: 80px;
  min-width: 60px;
  max-width: 100px;
  text-align: center;
  flex-shrink: 0;
}
```

**Step 3: Fix form-field overflow**

Add overflow handling:

```css
.form-field input,
.form-field select,
.form-field textarea {
  /* ... existing styles ... */
  min-width: 0; /* Allow shrinking in flex/grid */
  box-sizing: border-box;
}
```

**Step 4: Fix custom model input spacing**

Update `.custom-model-input`:

```css
.custom-model-input {
  margin-top: 8px;
  width: 100%;
}
```

**Step 5: Fix form-grid responsive behavior**

Ensure form-grid handles narrow widths:

```css
@media (max-width: 500px) {
  .form-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .form-field.full-width {
    grid-column: 1;
  }
}
```

**Step 6: Verify fixes**

Run: `pnpm run dev`
Open: /admin
Test: Resize window to various widths
Verify: Inputs don't overflow, layout adapts smoothly

**Step 7: Commit**

```bash
git add packages/client/src/views/AdminView.vue
git commit -m "fix(admin): improve input box layout handling"
```

---

## Task 9: Apply Font Scale to All Layouts

**Files:**
- Modify: `packages/client/src/layouts/FactsColumnsLayout.vue`
- Modify: `packages/client/src/layouts/FactsOverlayLayout.vue`
- Modify: `packages/client/src/layouts/FactsCarouselLayout.vue`
- Modify: `packages/client/src/layouts/DetailedLayout.vue`
- Modify: `packages/client/src/layouts/AmbientLayout.vue`
- Modify: `packages/client/src/layouts/MinimalLayout.vue`

**Step 1: Update key font-size declarations**

For each layout, wrap font-size values with calc() to apply --font-scale:

Before:
```css
.fact-text {
  font-size: var(--text-lg);
}
```

After:
```css
.fact-text {
  font-size: calc(var(--text-lg) * var(--font-scale, 1));
}
```

Apply to:
- `.fact-text`
- `.metadata .title`
- `.metadata .artist-album`
- `.zone-indicator`
- `.no-playback-text`
- Other primary text elements

**Step 2: Test each layout**

Run: `pnpm run dev`
Test: Each layout with font scale at 0.75x, 1.0x, and 1.5x
Verify: Text scales proportionally, no overflow

**Step 3: Commit**

```bash
git add packages/client/src/layouts/
git commit -m "feat(layouts): apply --font-scale to all layout typography"
```

---

## Task 10: Load Initial Display Settings on Client

**Files:**
- Modify: `packages/client/src/composables/useWebSocket.ts`
- Modify: `packages/server/src/websocket.ts`

**Step 1: Send display settings on client connect**

In server websocket.ts, when a non-admin client connects, send current display settings:

```typescript
import { loadDisplaySettings } from './display-settings';

// In connection handler, after initial state:
const displaySettings = loadDisplaySettings();
ws.send(JSON.stringify({
  type: 'display_settings_update',
  settings: displaySettings,
}));
```

**Step 2: Verify initial load**

Run: `pnpm run dev`
Set: Font scale to 1.25 via admin
Refresh: Main page
Verify: Font scale is 1.25 immediately (not 1.0)

**Step 3: Commit**

```bash
git add packages/server/src/websocket.ts
git commit -m "feat(server): send display settings to clients on connect"
```

---

## Verification Checklist

After all tasks complete:

- [ ] Global font scale slider works in /admin → Display
- [ ] Changes broadcast to all connected clients in real-time
- [ ] Per-screen override works in /admin/screen/:name
- [ ] Font scale persists across server restarts
- [ ] Font scale applies correctly on client page refresh
- [ ] Input boxes in admin panel don't overflow
- [ ] All facts layouts respect the font scale
- [ ] Slider range is 0.75 to 1.5 with 0.05 step
- [ ] Debounced save prevents excessive API calls
