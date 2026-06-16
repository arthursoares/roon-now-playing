# Server-Authoritative Client Configuration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the server the persistent source of truth for per-device client configuration, so admin changes survive client reconnects and devices can be fully reset from the admin UI.

**Architecture:** Add a `ClientSettingsStore` (mirroring `ClientNameStore`) that persists layout/font/background/zone/fontScaleOverride per deviceId. On client connect, server pushes stored settings via `remote_settings`. Client applies them, then re-applies URL params on top. Admin can delete a device, triggering a `client_reset` message that clears client localStorage and reloads.

**Tech Stack:** TypeScript, Node.js server, Vue 3 client, WebSocket messaging

---

### Task 1: Add `ClientSettingsStore` to server

**Files:**
- Create: `packages/server/src/clientSettings.ts`
- Test: `packages/server/src/clientSettings.spec.ts`

**Step 1: Write the test file**

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import { ClientSettingsStore } from './clientSettings.js';

const TEST_FILE = './test-client-settings.json';

describe('ClientSettingsStore', () => {
  afterEach(() => {
    if (fs.existsSync(TEST_FILE)) fs.unlinkSync(TEST_FILE);
  });

  it('should return null for unknown device', () => {
    const store = new ClientSettingsStore(TEST_FILE);
    expect(store.get('unknown')).toBeNull();
  });

  it('should persist and retrieve settings', () => {
    const store = new ClientSettingsStore(TEST_FILE);
    const settings = {
      layout: 'ambient' as const,
      font: 'inter' as const,
      background: 'gradient-radial' as const,
      zoneId: 'zone-1',
      zoneName: 'HiFi',
      fontScaleOverride: null,
    };
    store.set('device-1', settings);
    expect(store.get('device-1')).toEqual(settings);
  });

  it('should load from disk on construction', () => {
    const store1 = new ClientSettingsStore(TEST_FILE);
    store1.set('device-1', {
      layout: 'minimal' as const,
      font: 'system' as const,
      background: 'black' as const,
      zoneId: null,
      zoneName: null,
      fontScaleOverride: null,
    });

    const store2 = new ClientSettingsStore(TEST_FILE);
    const loaded = store2.get('device-1');
    expect(loaded).not.toBeNull();
    expect(loaded!.layout).toBe('minimal');
  });

  it('should delete settings', () => {
    const store = new ClientSettingsStore(TEST_FILE);
    store.set('device-1', {
      layout: 'detailed' as const,
      font: 'system' as const,
      background: 'black' as const,
      zoneId: null,
      zoneName: null,
      fontScaleOverride: null,
    });
    store.delete('device-1');
    expect(store.get('device-1')).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --run`
Expected: FAIL — `ClientSettingsStore` not found

**Step 3: Write the implementation**

```typescript
import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';
import type { LayoutType, FontType, BackgroundType } from '@roon-screen-cover/shared';

const DATA_DIR = process.env.DATA_DIR || './config';
const DEFAULT_FILE = path.join(DATA_DIR, 'client-settings.json');

export interface ClientSettings {
  layout: LayoutType;
  font: FontType;
  background: BackgroundType;
  zoneId: string | null;
  zoneName: string | null;
  fontScaleOverride: number | null;
}

export class ClientSettingsStore {
  private settings: Map<string, ClientSettings> = new Map();
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath || DEFAULT_FILE;
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(data) as Record<string, ClientSettings>;
        this.settings = new Map(Object.entries(parsed));
        logger.info(`Loaded ${this.settings.size} client settings from ${this.filePath}`);
      }
    } catch (error) {
      logger.error(`Failed to load client settings: ${error}`);
    }
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const data = Object.fromEntries(this.settings);
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      logger.error(`Failed to save client settings: ${error}`);
    }
  }

  get(deviceId: string): ClientSettings | null {
    return this.settings.get(deviceId) || null;
  }

  set(deviceId: string, settings: ClientSettings): void {
    this.settings.set(deviceId, settings);
    this.save();
  }

  delete(deviceId: string): void {
    this.settings.delete(deviceId);
    this.save();
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --run`
Expected: PASS

**Step 5: Commit**

```
git add packages/server/src/clientSettings.ts packages/server/src/clientSettings.spec.ts
git commit -m "feat: add ClientSettingsStore for per-device config persistence"
```

---

### Task 2: Wire `ClientSettingsStore` into server startup

**Files:**
- Modify: `packages/server/src/index.ts`
- Modify: `packages/server/src/websocket.ts`

**Step 1: Add `clientSettingsStore` to `index.ts`**

In `packages/server/src/index.ts`, after `const clientNameStore = new ClientNameStore();` (line 31), add:

```typescript
import { ClientSettingsStore } from './clientSettings.js';
// ...
const clientSettingsStore = new ClientSettingsStore();
```

After `wsManager.setFriendlyNameChangeCallback(...)` (line 47-49), add:

```typescript
wsManager.setClientSettingsStore(clientSettingsStore);
```

**Step 2: Add `setClientSettingsStore` method to `WebSocketManager`**

In `packages/server/src/websocket.ts`, add a new private field and setter:

```typescript
private clientSettingsStore: ClientSettingsStore | null = null;

setClientSettingsStore(store: ClientSettingsStore): void {
  this.clientSettingsStore = store;
}
```

Add the import at top:

```typescript
import type { ClientSettingsStore, ClientSettings } from './clientSettings.js';
```

**Step 3: Run typecheck**

Run: `cd packages/server && npx tsc --noEmit`
Expected: no errors

**Step 4: Commit**

```
git add packages/server/src/index.ts packages/server/src/websocket.ts
git commit -m "feat: wire ClientSettingsStore into server startup"
```

---

### Task 3: Persist settings on client metadata and push stored settings on connect

**Files:**
- Modify: `packages/server/src/websocket.ts` — `handleClientMetadata` method (~line 296)

**Step 1: In `handleClientMetadata`, after `this.clientsById.set(message.clientId, clientState)` (line 349), persist settings**

Add after the `clientsById.set` line:

```typescript
// Persist client settings
if (this.clientSettingsStore) {
  this.clientSettingsStore.set(deviceId, {
    layout: clientState.layout,
    font: clientState.font,
    background: clientState.background,
    zoneId: clientState.subscribedZoneId,
    zoneName: clientState.subscribedZoneName,
    fontScaleOverride: clientState.fontScaleOverride ?? null,
  });
}
```

**Step 2: Push stored settings to client on first connect**

In `handleClientMetadata`, after sending the `connection` message (after line 363), add logic to push stored settings for first-time connections:

```typescript
// On first connect, push server-stored settings if they differ from what client sent
if (isNewClient && this.clientSettingsStore) {
  const storedSettings = this.clientSettingsStore.get(deviceId);
  if (storedSettings) {
    // Server has stored config — push it to the client (server wins)
    const needsPush =
      storedSettings.layout !== clientState.layout ||
      storedSettings.font !== clientState.font ||
      storedSettings.background !== clientState.background ||
      storedSettings.zoneId !== clientState.subscribedZoneId ||
      storedSettings.fontScaleOverride !== (clientState.fontScaleOverride ?? null);

    if (needsPush) {
      this.sendToClient(clientState.ws, {
        type: 'remote_settings',
        layout: storedSettings.layout,
        font: storedSettings.font,
        background: storedSettings.background,
        zoneId: storedSettings.zoneId ?? undefined,
        zoneName: storedSettings.zoneName ?? undefined,
        fontScaleOverride: storedSettings.fontScaleOverride,
      } as ServerRemoteSettingsMessage);

      // Update local state to match
      clientState.layout = storedSettings.layout;
      clientState.font = storedSettings.font;
      clientState.background = storedSettings.background;
      clientState.subscribedZoneId = storedSettings.zoneId;
      clientState.subscribedZoneName = storedSettings.zoneName;
      clientState.fontScaleOverride = storedSettings.fontScaleOverride;
    }
  }
}
```

**Step 3: Also persist when admin pushes settings**

In `pushSettingsToClient` method, after updating local state for all connections, add persistence:

```typescript
// Persist to settings store
if (this.clientSettingsStore) {
  this.clientSettingsStore.set(clientState.deviceId, {
    layout: clientState.layout,
    font: clientState.font,
    background: clientState.background,
    zoneId: clientState.subscribedZoneId,
    zoneName: clientState.subscribedZoneName,
    fontScaleOverride: clientState.fontScaleOverride ?? null,
  });
}
```

**Step 4: Run tests and typecheck**

Run: `pnpm test -- --run && cd packages/server && npx tsc --noEmit`
Expected: all pass, no type errors

**Step 5: Commit**

```
git add packages/server/src/websocket.ts
git commit -m "feat: persist client settings and push stored config on connect"
```

---

### Task 4: Ensure URL params override server-pushed settings on client

**Files:**
- Modify: `packages/client/src/views/NowPlayingView.vue`

**Step 1: In `handleRemoteSettings`, re-apply URL params after applying server config**

The existing `handleRemoteSettings` function (line 29-58) already applies server settings to localStorage. After it runs, URL params need to win. Modify the function:

```typescript
function handleRemoteSettings(settings: {
  layout?: LayoutType;
  font?: FontType;
  background?: BackgroundType;
  fontScaleOverride?: number | null;
  zoneId?: string;
  zoneName?: string;
}) {
  if (settings.layout) {
    saveLayoutPreference(settings.layout);
  }
  if (settings.font) {
    saveFontPreference(settings.font);
  }
  if (settings.background) {
    saveBackgroundPreference(settings.background);
  }
  if (settings.fontScaleOverride !== undefined) {
    currentFontScaleOverride.value = settings.fontScaleOverride;
  }
  if (settings.zoneId) {
    selectedZoneId.value = settings.zoneId;
    selectedZoneName.value = settings.zoneName || null;
    if (settings.zoneName) {
      saveZonePreference(settings.zoneName);
    }
    subscribeToZone(settings.zoneId, settings.zoneName);
    showZonePicker.value = false;
  }

  // URL params always win — re-apply after server push
  reapplyUrlParams();
}
```

Add `reapplyUrlParams` to the return value of `usePreferences` and implement it:

In `packages/client/src/composables/usePreferences.ts`, add:

```typescript
function reapplyUrlParams(): void {
  const urlParams = getUrlParams();
  if (urlParams.layout) layout.value = urlParams.layout;
  if (urlParams.font) font.value = urlParams.font;
  if (urlParams.background) background.value = urlParams.background;
  // Note: zone URL param is handled separately in NowPlayingView's zone matching logic
}
```

Add `reapplyUrlParams` to the return object.

**Step 2: Run typecheck**

Run: `cd packages/client && pnpm run typecheck`
Expected: no errors

**Step 3: Commit**

```
git add packages/client/src/composables/usePreferences.ts packages/client/src/views/NowPlayingView.vue
git commit -m "feat: re-apply URL params after server config push"
```

---

### Task 5: Add `client_reset` message type and `DELETE` endpoint

**Files:**
- Modify: `packages/shared/src/index.ts` — add message type
- Modify: `packages/server/src/admin.ts` — add DELETE endpoint
- Modify: `packages/server/src/websocket.ts` — add `removeClient` method

**Step 1: Add `ServerClientResetMessage` to shared types**

In `packages/shared/src/index.ts`, after `ServerRemoteSettingsMessage` (line 310), add:

```typescript
export interface ServerClientResetMessage {
  type: 'client_reset';
}
```

Add it to the `ServerMessage` union type (line 372-383):

```typescript
  | ServerClientResetMessage
```

**Step 2: Add `removeClient` method to `WebSocketManager`**

In `packages/server/src/websocket.ts`:

```typescript
removeClient(clientId: string): boolean {
  const clientState = this.clientsById.get(clientId);
  if (!clientState) return false;

  const deviceId = clientState.deviceId;

  // Delete stored settings and friendly name
  if (this.clientSettingsStore) {
    this.clientSettingsStore.delete(deviceId);
  }
  this.friendlyNames.delete(deviceId);
  if (this.onFriendlyNameChange) {
    this.onFriendlyNameChange(deviceId, null);
  }

  // Send reset to all connections from this device, then close them
  const deviceConnections = this.getAllConnectionsForDevice(deviceId);
  for (const conn of deviceConnections) {
    if (conn.ws.readyState === WebSocket.OPEN) {
      this.sendToClient(conn.ws, { type: 'client_reset' } as ServerMessage);
      conn.ws.close();
    }
    this.clientsById.delete(conn.clientId);
    this.clients.delete(conn.ws);
  }

  // Notify admins
  this.broadcastToAdmins({
    type: 'client_disconnected',
    clientId,
  });

  return true;
}
```

**Step 3: Add DELETE endpoint in `admin.ts`**

In `packages/server/src/admin.ts`, before the `return router;` line:

```typescript
// Remove a client (full reset)
router.delete('/clients/:clientId', (req, res) => {
  const { clientId } = req.params;
  const success = wsManager.removeClient(clientId);
  if (success) {
    logger.info(`Removed client ${clientId}`);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Client not found' });
  }
});
```

**Step 4: Run typecheck**

Run: `cd packages/server && npx tsc --noEmit && cd ../shared && npx tsc --noEmit`
Expected: no errors

**Step 5: Commit**

```
git add packages/shared/src/index.ts packages/server/src/websocket.ts packages/server/src/admin.ts
git commit -m "feat: add client reset endpoint and message type"
```

---

### Task 6: Handle `client_reset` on the client

**Files:**
- Modify: `packages/client/src/composables/useWebSocket.ts`

**Step 1: Add handler for `client_reset` message**

In `useWebSocket.ts`, in the message switch statement (after `case 'display_settings_update'`), add:

```typescript
case 'client_reset':
  console.log('[WS] Received client reset — clearing all local state');
  localStorage.removeItem('roon-screen-cover:device-id');
  localStorage.removeItem('roon-screen-cover:zone');
  localStorage.removeItem('roon-screen-cover:layout');
  localStorage.removeItem('roon-screen-cover:font');
  localStorage.removeItem('roon-screen-cover:background');
  window.location.reload();
  break;
```

**Step 2: Run typecheck**

Run: `cd packages/client && pnpm run typecheck`
Expected: no errors

**Step 3: Commit**

```
git add packages/client/src/composables/useWebSocket.ts
git commit -m "feat: handle client_reset by clearing localStorage and reloading"
```

---

### Task 7: Final verification

**Step 1: Run all tests**

Run: `pnpm test -- --run`
Expected: all pass

**Step 2: Run typechecks**

Run: `cd packages/client && pnpm run typecheck && cd ../server && npx tsc --noEmit`
Expected: no errors

**Step 3: Manual testing**

1. Start server and client: `pnpm dev`
2. Open a display tab — verify it connects and sends metadata
3. Open admin — change the display's layout → display updates
4. Refresh the display tab → verify it reconnects with the server-stored layout (not reverting to defaults)
5. Open display with URL param `?layout=minimal` → verify URL param wins over stored config
6. From admin, delete the client → verify the display clears and shows welcome screen with new identity
