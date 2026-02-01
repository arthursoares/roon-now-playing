# External Sources API

This API allows external music sources to push now-playing data to the Roon Screen Cover display system.

## Overview

External sources appear as zones alongside Roon zones. Display clients can subscribe to any zone, regardless of whether it's from Roon or an external source.

## Quick Start

Push a now-playing update:

```bash
curl -X POST http://localhost:3000/api/sources/my-player/now-playing \
  -H "Content-Type: application/json" \
  -d '{
    "zone_name": "My Music Player",
    "state": "playing",
    "title": "Song Title",
    "artist": "Artist Name",
    "album": "Album Name",
    "duration_seconds": 180,
    "seek_position": 0
  }'
```

## Authentication

By default, the API is open (no authentication required). You can enable API key authentication in the admin panel.

When enabled, include the API key in your requests:

```bash
curl -X POST http://localhost:3000/api/sources/my-player/now-playing \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key-here" \
  -d '{ ... }'
```

## API Reference

### Push Now-Playing Update

```
POST /api/sources/:zoneId/now-playing
```

Creates or updates a zone with current playback state.

**Path Parameters:**
- `zoneId` - Stable identifier for your source (e.g., `spotify-office`, `plex-living-room`)

**Request Body:**

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
| `artwork_base64` | string | No | Base64-encoded image |

**Response:**

```json
{
  "success": true,
  "zone_id": "my-player",
  "artwork_key": "abc123"
}
```

### Delete Zone

```
DELETE /api/sources/:zoneId
```

Permanently removes a zone.

### List Zones

```
GET /api/sources
```

Returns all external zones.

## Best Practices

### Zone ID Naming

Use stable, descriptive zone IDs:
- `spotify-living-room` - Good
- `plex-office` - Good
- `temp-12345` - Bad (not stable)

### Update Frequency

- Send updates every 1-5 seconds when playing
- Send a single update when pausing/stopping
- No need to send updates while paused

### Artwork

- Prefer `artwork_url` over `artwork_base64` (less bandwidth)
- Keep images under 1000x1000 pixels
- Use JPEG format for best compatibility

### Graceful Shutdown

When your player stops, send a final update with `state: "stopped"`:

```bash
curl -X POST http://localhost:3000/api/sources/my-player/now-playing \
  -H "Content-Type: application/json" \
  -d '{"zone_name": "My Player", "state": "stopped"}'
```

## Example Integrations

### Shell Script

```bash
#!/bin/bash
# Simple now-playing updater

API_URL="http://localhost:3000/api/sources/my-script/now-playing"

update_now_playing() {
  curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"zone_name\": \"My Script Player\",
      \"state\": \"$1\",
      \"title\": \"$2\",
      \"artist\": \"$3\",
      \"album\": \"$4\"
    }"
}

# Example usage
update_now_playing "playing" "Song Name" "Artist" "Album"
```

### Python

```python
import requests
import time

API_URL = "http://localhost:3000/api/sources/python-player/now-playing"

def update_now_playing(state, title=None, artist=None, album=None, position=0):
    payload = {
        "zone_name": "Python Player",
        "state": state,
    }
    if state != "stopped":
        payload.update({
            "title": title,
            "artist": artist,
            "album": album,
            "seek_position": position,
        })

    response = requests.post(API_URL, json=payload)
    return response.json()

# Example: Update every second while playing
position = 0
while True:
    update_now_playing("playing", "My Song", "My Artist", "My Album", position)
    position += 1
    time.sleep(1)
```

### Node.js

```javascript
const API_URL = 'http://localhost:3000/api/sources/node-player/now-playing';

async function updateNowPlaying(state, track = {}) {
  const payload = {
    zone_name: 'Node.js Player',
    state,
    ...track,
  };

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return response.json();
}

// Example usage
await updateNowPlaying('playing', {
  title: 'Song Title',
  artist: 'Artist Name',
  album: 'Album Name',
  duration_seconds: 180,
  seek_position: 0,
});
```

## Troubleshooting

### Zone Not Appearing

1. Check the response from your POST request for errors
2. Verify the zone_name and state fields are present
3. Check server logs for validation errors

### Zone Shows as Disconnected

Zones automatically become "disconnected" after 60 seconds of no updates. Send regular updates while playing.

### Authentication Errors

If you get a 401 response:
1. Check if API key authentication is enabled in the admin panel
2. Verify your `X-API-Key` header is correct
3. Generate a new key if needed
