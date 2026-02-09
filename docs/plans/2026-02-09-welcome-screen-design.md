# Self-Service Welcome Screen Design

**Date:** 2026-02-09
**Status:** Implemented

## Overview

Replace the Roon-specific "Waiting for Roon Core..." screen with a generic, self-service welcome experience. New screens get auto-generated friendly names and display a QR code linking to a dedicated per-screen config page. Users scan the QR from their phone to configure the display — no manual ID wrangling needed.

## Goals

- Remove Roon-specific language from the first-load experience
- Auto-assign memorable names to screens (adjective-animal-number style)
- Display a QR code linking directly to that screen's config page
- Provide a focused, mobile-friendly per-screen config page
- Zero-config — no `BASE_URL` or server-side URL knowledge needed

## Design Decisions

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Name generation | Server-side, on first connect | Single source of truth, guarantees uniqueness |
| Name format | `adjective-animal-number` | Memorable, human-friendly, Heroku-style |
| QR generation | Client-side via `qrcode` npm | Uses `window.location.origin` — works behind proxies, zero config |
| Config page | Dedicated `/admin/screen/:name` route | Focused mobile UX, not the full admin dashboard |
| Name override | Admin can rename anytime | Auto-name is a sensible default, not a constraint |

## Components

### 1. Name Generator (`packages/server/src/nameGenerator.ts`)

New module with:
- ~50 adjectives and ~50 animals word lists
- `generateFriendlyName(existingNames: Set<string>): string` function
- Format: `adjective-animal-NN` (number 1-99)
- Collision check against existing names, retry if needed
- ~250,000 possible combinations

### 2. Auto-Assignment in WebSocket (`packages/server/src/websocket.ts`)

When processing client metadata:
1. Extract device ID from client ID
2. Check if device ID has a stored friendly name
3. If not, call `generateFriendlyName()` with current names set
4. Persist via `ClientNameStore`
5. Include `friendly_name` in the WebSocket `connection` message

### 3. Wire Protocol Changes (`packages/shared/src/index.ts`)

Add to `ServerConnectionMessage`:
```typescript
friendly_name?: string;
```

### 4. Client State (`packages/client/src/composables/useWebSocket.ts`)

Add `friendlyName: string | null` to `WebSocketState`. Updated when `connection` message includes `friendly_name`.

### 5. Welcome Screen (`packages/client/src/views/NowPlayingView.vue`)

Replace the "Waiting for Roon Core..." overlay. Shows when WebSocket is connected but no zone is active.

Displays:
- Screen's friendly name (large text)
- QR code → `${window.location.origin}/admin/screen/${friendlyName}`
- Caption: "Scan to configure this display"

Visual: dark background, white text and QR, centered. Consistent with now-playing aesthetic.

The "Connecting to server..." spinner remains unchanged for the brief WebSocket connection phase.

### 6. Per-Screen Config Page

**Route:** `/admin/screen/:friendlyName`
**Component:** `ScreenConfigView.vue`

Mobile-friendly, focused config for one screen:
- Screen name (editable — tap to rename)
- Zone picker (list of available zones)
- Layout picker
- Font picker
- Background picker
- Connection status indicator

**How it works:**
- Connects via WebSocket with `isAdmin` flag (same as existing admin page)
- Receives client list, filters to matching friendly name
- Pushes settings via existing `POST /api/admin/clients/:clientId/push` endpoint

**New API endpoint:**
- `GET /api/admin/screens/:friendlyName` — resolves friendly name to client ID and state

### 7. QR Code Library

Add `qrcode` package to `packages/client`.
- Renders to canvas or data URL
- White-on-dark styling
- ~200x200px size
- Reactive — updates if name changes

## Not In Scope

- Changes to the existing admin dashboard layout
- Server-side QR generation
- Leo's `ROON_ENABLED` PR changes (this design builds alongside those)
- Authentication for the per-screen config page
