# Self-Service Welcome Screen — Implementation Plan

**Date:** 2026-02-09
**Status:** Complete
**Design:** [2026-02-09-welcome-screen-design.md](./2026-02-09-welcome-screen-design.md)

## Steps

### Step 1: Name Generator Module
**New file:** `packages/server/src/nameGenerator.ts`

Create module with:
- `ADJECTIVES` array (~50 words)
- `ANIMALS` array (~50 words)
- `generateFriendlyName(existingNames: Set<string>): string`
  - Format: `adjective-animal-NN` (NN = 1-99)
  - Random selection, collision check, retry loop (max 10 attempts, then fall back to UUID-based name)

**Test:** Unit test in `packages/server/src/__tests__/nameGenerator.test.ts`

---

### Step 2: Wire Protocol — Add `friendly_name` to Connection Message
**File:** `packages/shared/src/index.ts` (line 247-251)

Add `friendly_name?: string` to `ServerConnectionMessage`:
```typescript
export interface ServerConnectionMessage {
  type: 'connection';
  status: 'connected' | 'disconnected';
  roon_connected: boolean;
  friendly_name?: string;  // NEW
}
```

---

### Step 3: Server — Auto-Generate Names on First Connect
**File:** `packages/server/src/websocket.ts`

A. Import `generateFriendlyName` from `./nameGenerator.js`

B. In `handleClientMetadata()` (line 302-306), after checking for stored name:
```typescript
// If no stored name, auto-generate one
if (!storedName) {
  const existingNames = new Set(this.friendlyNames.values());
  const generated = generateFriendlyName(existingNames);
  clientState.friendlyName = generated;
  this.friendlyNames.set(deviceId, generated);
  if (this.onFriendlyNameChange) {
    this.onFriendlyNameChange(deviceId, generated);
  }
} else {
  clientState.friendlyName = storedName;
}
```

C. After metadata is processed, send a `connection` message with `friendly_name` to the client:
```typescript
this.sendToClient(clientState.ws, {
  type: 'connection',
  status: 'connected',
  roon_connected: this.roonClient.isConnected(),
  friendly_name: clientState.friendlyName,
});
```

D. Also include `friendly_name` in the initial connection message (line 102-107) — but only after metadata is received (the name isn't known yet at initial connect). The existing initial message stays as-is; the name is sent in the post-metadata message above.

---

### Step 4: Client State — Store `friendlyName`
**File:** `packages/client/src/composables/useWebSocket.ts`

A. Add to `WebSocketState` interface (line 15-22):
```typescript
friendlyName: string | null;
```

B. Initialize in state ref:
```typescript
friendlyName: null,
```

C. In `handleMessage`, `connection` case (line 152-154):
```typescript
case 'connection':
  state.value.roonConnected = message.roon_connected;
  if (message.friendly_name) {
    state.value.friendlyName = message.friendly_name;
  }
  break;
```

---

### Step 5: Welcome Screen — Replace Roon-Specific Overlay
**File:** `packages/client/src/views/NowPlayingView.vue`

A. Install `qrcode` in client package:
```bash
cd packages/client && npm install qrcode && npm install -D @types/qrcode
```

B. Add QR code generation logic in `<script setup>`:
```typescript
import QRCode from 'qrcode';

const qrCodeDataUrl = ref<string | null>(null);
const configUrl = computed(() => {
  const name = wsState.value.friendlyName;
  if (!name) return null;
  return `${window.location.origin}/admin/screen/${encodeURIComponent(name)}`;
});

watch(configUrl, async (url) => {
  if (url) {
    qrCodeDataUrl.value = await QRCode.toDataURL(url, {
      width: 200,
      margin: 2,
      color: { dark: '#ffffff', light: '#00000000' },
    });
  }
}, { immediate: true });
```

C. Update `connectionStatus` computed (line 74-79):
Replace `'waiting-roon'` state with `'welcome'` — shown when connected but no zones and no zone selected:
```typescript
const connectionStatus = computed(() => {
  if (!wsState.value.connected) return 'connecting';
  if (wsState.value.zones.length === 0 && !selectedZoneId.value) return 'welcome';
  return 'connected';
});
```

D. Replace the connection overlay template (lines 155-162):
```vue
<!-- Connecting spinner -->
<div v-if="connectionStatus === 'connecting'" class="connection-overlay">
  <div class="connection-status">
    <div class="spinner"></div>
    <p>Connecting to server...</p>
  </div>
</div>

<!-- Welcome screen -->
<div v-else-if="connectionStatus === 'welcome'" class="connection-overlay welcome-screen">
  <div class="welcome-content">
    <h1 v-if="wsState.friendlyName" class="screen-name">{{ wsState.friendlyName }}</h1>
    <img v-if="qrCodeDataUrl" :src="qrCodeDataUrl" alt="Config QR Code" class="qr-code" />
    <p class="welcome-caption">Scan to configure this display</p>
  </div>
</div>
```

E. Add CSS for welcome screen:
```css
.welcome-screen {
  flex-direction: column;
}

.welcome-content {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.screen-name {
  font-size: 2rem;
  font-weight: 300;
  color: #fff;
  letter-spacing: 0.05em;
}

.qr-code {
  width: 200px;
  height: 200px;
}

.welcome-caption {
  font-size: 1rem;
  color: #888;
}
```

---

### Step 6: Per-Screen Config Route
**File:** `packages/client/src/router.ts`

Add new route:
```typescript
{
  path: '/admin/screen/:friendlyName',
  name: 'screen-config',
  component: () => import('./views/ScreenConfigView.vue'),
}
```

---

### Step 7: Server API — Resolve Friendly Name to Client
**File:** `packages/server/src/admin.ts`

Add endpoint:
```typescript
router.get('/screens/:friendlyName', (req, res) => {
  const { friendlyName } = req.params;
  const client = wsManager.getClientByFriendlyName(friendlyName);
  if (client) {
    res.json({ client });
  } else {
    res.status(404).json({ error: 'Screen not found' });
  }
});
```

**File:** `packages/server/src/websocket.ts`

Add method to `WebSocketManager`:
```typescript
getClientByFriendlyName(name: string): ClientMetadata | null {
  for (const state of this.clients.values()) {
    if (state.friendlyName === name) {
      return this.getClientMetadata(state);
    }
  }
  return null;
}
```

---

### Step 8: Per-Screen Config Component
**New file:** `packages/client/src/views/ScreenConfigView.vue`

Mobile-friendly config page:
- Uses `useRoute()` to get `friendlyName` param
- Connects via WebSocket with `isAdmin: true`
- Polls `GET /api/admin/screens/:friendlyName` to resolve client
- Shows: screen name (editable), zone picker, layout/font/background pickers
- Pushes settings via existing `POST /api/admin/clients/:clientId/push`
- Simple stacked layout, large tap targets

---

### Step 9: Integration Testing
- Start server, open a new client — verify welcome screen appears with friendly name + QR
- Scan QR (or navigate to URL) — verify per-screen config page loads
- Change zone from config page — verify display switches to now-playing
- Reconnect same device — verify same friendly name persists
- Rename from admin — verify welcome screen updates

## Dependency Order

```
Step 1 (name generator) ──┐
Step 2 (shared types)  ───┼── Step 3 (server auto-gen) ── Step 4 (client state) ── Step 5 (welcome screen)
                          │
                          └── Step 7 (server API) ── Step 6 (route) ── Step 8 (config page)
                                                                              │
                                                                              └── Step 9 (integration test)
```

Steps 1, 2 can be done in parallel.
Steps 3+4+5 are sequential (server → client state → UI).
Steps 6+7+8 can be done in parallel with 3+4+5 after step 2.
Step 9 after everything.
