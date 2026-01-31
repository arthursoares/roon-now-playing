# External Sources API Design

**Date:** 2026-01-31
**Status:** Approved

## Overview

Extend the application to support a generic API that allows external music sources (not just Roon) to push now-playing data to display clients. This enables integrations with any music player or service without building source-specific code.

## Goals

- Allow any external source to push now-playing data via REST API
- External sources appear as zones alongside Roon zones
- Minimal friction for integrators
- Optional authentication for security-conscious users
- Comprehensive documentation for third-party integrations

## Design Decisions

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Authentication | API keys optional, configurable via admin | Flexibility - simple for home users, secure if needed |
| Zone model | External sources are first-class zones | Clients don't need to distinguish source types |
| Lifecycle | Persistent zones with connection state | Stable zone IDs for configured displays |
| Roon integration | Stays special internally | Less refactoring, ship faster |

## API Design

### Endpoints

#### Push Now-Playing Update

```
POST /api/sources/:zoneId/now-playing
```

Creates or updates an external zone with current playback state.

**Headers:**
- `Content-Type: application/json`
- `X-API-Key: <key>` (required only if auth enabled)

**Path Parameters:**
- `zoneId` - Stable identifier for this source (e.g., `spotify-office`, `plex-living-room`)

**Request Body:**

```json
{
  "zone_name": "Office Spotify",
  "state": "playing",
  "title": "Song Title",
  "artist": "Artist Name",
  "album": "Album Name",
  "duration_seconds": 240,
  "seek_position": 45,
  "artwork_url": "https://example.com/cover.jpg"
}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `zone_name` | string | Yes | Display name shown in UI |
| `state` | string | Yes | `playing`, `paused`, or `stopped` |
| `title` | string | When playing | Track title |
| `artist` | string | When playing | Artist name |
| `album` | string | No | Album name |
| `duration_seconds` | number | No | Track length in seconds |
| `seek_position` | number | No | Current position in seconds |
| `artwork_url` | string | No | URL to album artwork |
| `artwork_base64` | string | No | Base64-encoded image (alternative to URL) |

**Response:**

```json
{
  "success": true,
  "zone_id": "spotify-office",
  "artwork_key": "abc123"
}
```

#### Delete Zone

```
DELETE /api/sources/:zoneId
```

Permanently removes an external zone.

**Headers:**
- `X-API-Key: <key>` (required only if auth enabled)

**Response:**

```json
{
  "success": true
}
```

#### List External Zones

```
GET /api/sources
```

Returns all registered external zones (for admin/debugging).

**Response:**

```json
{
  "zones": [
    {
      "zone_id": "spotify-office",
      "zone_name": "Office Spotify",
      "source_status": "connected",
      "state": "playing",
      "last_seen": "2026-01-31T19:00:00Z"
    }
  ]
}
```

### Existing Endpoint Changes

#### GET /api/zones

Now returns both Roon and external zones with a `source` field:

```json
{
  "connected": true,
  "zones": [
    { "id": "roon-zone-1", "display_name": "Living Room", "source": "roon" },
    { "id": "spotify-office", "display_name": "Office Spotify", "source": "external" }
  ]
}
```

## Zone Lifecycle

### States

Each external zone has a `source_status`:
- `connected` - Source is actively sending updates
- `disconnected` - No updates received recently (>60 seconds)

### Behavior

1. **First update** - Zone created, `source_status: connected`
2. **Subsequent updates** - Resets `last_seen` timestamp
3. **Timeout (60s no updates)** - Zone becomes `disconnected`, state set to `stopped`
4. **Updates resume** - Zone becomes `connected` again
5. **DELETE call** - Zone removed permanently

### Persistence

- Zones persist across server restarts
- Display clients can stay subscribed to a zone that is currently disconnected
- When source reconnects, playback resumes automatically on displays

## Authentication

### Configuration

- Toggle in admin panel: "Require API key for external sources"
- Default: disabled (open API)
- Single shared API key (not per-source)

### Implementation

- Generate random UUID as API key
- Store in `./config/sources-config.json`
- Validate `X-API-Key` header on source endpoints when enabled
- Return 401 Unauthorized if key missing/invalid

## Server Architecture

### New Components

**ExternalSourceManager** (`packages/server/src/externalSources.ts`)

```typescript
interface ExternalZone {
  zone_id: string;
  zone_name: string;
  state: PlaybackState;
  track: Track | null;
  seek_position: number;
  source_status: 'connected' | 'disconnected';
  last_seen: Date;
  artwork_key: string | null;
}

class ExternalSourceManager extends EventEmitter {
  // Events: 'zones', 'now_playing', 'seek' (same as RoonClient)

  updateZone(zoneId: string, data: ExternalUpdatePayload): void;
  deleteZone(zoneId: string): void;
  getZones(): Zone[];
  getNowPlaying(zoneId: string): NowPlaying | null;
}
```

**Routes** (`packages/server/src/routes/sources.ts`)

- POST `/api/sources/:zoneId/now-playing`
- DELETE `/api/sources/:zoneId`
- GET `/api/sources`

### WebSocket Integration

- `WebSocketManager` listens to both `RoonClient` and `ExternalSourceManager`
- Same event types for both (`zones`, `now_playing`, `seek`)
- Combined zone list sent to clients
- Clients unaware of source distinction

### Artwork Handling

When artwork provided:
1. If `artwork_url` - fetch from URL, cache locally
2. If `artwork_base64` - decode, cache locally
3. Generate `artwork_key` (hash of content)
4. Return key in response
5. Clients use existing `GET /api/artwork/:key` endpoint

### Configuration Storage

**./config/sources-config.json**
```json
{
  "requireApiKey": false,
  "apiKey": "uuid-here"
}
```

**./config/external-zones.json**
```json
{
  "spotify-office": {
    "zone_name": "Office Spotify",
    "created_at": "2026-01-31T18:00:00Z",
    "last_seen": "2026-01-31T19:00:00Z"
  }
}
```

## Admin Panel Changes

New "External Sources" section:

1. **API Key Management**
   - Toggle: "Require API key"
   - Display current key (masked)
   - Generate/regenerate button
   - Copy to clipboard button

2. **External Zones List**
   - Table showing all external zones
   - Columns: Name, Zone ID, Status, Last Seen
   - Delete button per zone

## Files to Create/Modify

### New Files
- `packages/server/src/externalSources.ts` - ExternalSourceManager class
- `packages/server/src/routes/sources.ts` - API routes
- `packages/server/src/sourcesConfig.ts` - Config management
- `docs/external-api.md` - Integration documentation

### Modified Files
- `packages/server/src/index.ts` - Initialize ExternalSourceManager, mount routes
- `packages/server/src/websocket.ts` - Listen to ExternalSourceManager events
- `packages/server/src/routes/zones.ts` - Include external zones in response
- `packages/shared/src/index.ts` - Add new types
- `packages/client/src/views/AdminView.vue` - Add sources section

## Documentation

Create `docs/external-api.md` with:

1. **Overview** - What the API does, use cases
2. **Quick Start** - Minimal curl example
3. **Authentication** - How to enable/configure
4. **API Reference** - Full endpoint documentation
5. **Best Practices**
   - Stable zone_id naming conventions
   - Update frequency (1-5 seconds when playing)
   - Artwork guidelines
   - Graceful shutdown (send stopped state)
6. **Example Integrations**
   - Shell/curl script
   - Python example
   - Node.js example

## Future Considerations (Not in Scope)

- Per-source API keys
- Source-specific icons in UI
- Refactoring Roon to use same internal abstraction
- Webhook callbacks from server to sources
- Source discovery/announcement protocol
