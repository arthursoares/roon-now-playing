# Server-Authoritative Client Configuration

## Problem

When a client reconnects, it sends its localStorage config to the server. The server never pushes back what it knows. If an admin pushed settings while the client was offline, the client overwrites the server with stale config on reconnect.

## Design

### Storage

Server persists per-device config in `config/client-settings.json`, keyed by `deviceId`. Same pattern as existing `client-names.json`.

```json
{
  "device-uuid-1": {
    "layout": "ambient",
    "font": "inter",
    "background": "gradient-radial",
    "zoneId": "16017fb...",
    "zoneName": "HiFi",
    "fontScaleOverride": null,
    "updatedAt": 1741430000000
  }
}
```

### Data Flow

1. **Client connects** — sends `client_metadata` with its local config (as today)
2. **Server receives metadata** — checks if it has stored config for this `deviceId`
   - **No stored config**: accept the client's config, persist it server-side (first-time device)
   - **Has stored config**: send a `remote_settings` message back with the server's stored config (server wins)
3. **Client receives `remote_settings`** — applies and persists to localStorage (already works today)
4. **URL params** — client checks URL params after receiving server config. URL params always override. Client sends updated metadata back to server, which persists it.
5. **User changes setting locally** (click to change layout, etc.) — client sends `client_metadata` — server persists the update
6. **Admin pushes setting** — server persists + sends `remote_settings` — client applies. If client is offline, the change is already persisted server-side and will be pushed on next connect.

### Key Rules

- Server is the persistent store, client localStorage is a cache
- URL params always win (checked client-side after server push)
- Local user changes are sent to server immediately (already happening via `sendMetadata`)
- Admin changes always stick (persisted server-side, pushed on connect)

### Error Handling

- Corrupt/missing `client-settings.json` — start fresh (same as `client-names.json` pattern)
- Unknown deviceId — accept client's config as initial state
