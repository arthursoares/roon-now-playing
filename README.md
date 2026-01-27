# Roon Screen Cover

A Roon extension that displays real-time album artwork and track metadata on any web-connected client. Perfect for "always-on" displays like tablets and wall-mounted screens.

## Features

- Real-time album artwork and track metadata display
- Multiple simultaneous clients viewing different zones
- Three display layouts: Detailed, Minimal, and Fullscreen
- Automatic zone selection via URL parameters
- WebSocket-based real-time updates
- Artwork caching for performance
- Auto-reconnect on connection loss

## Quick Start

### Docker (Recommended)

```bash
docker-compose up -d
```

Then open `http://localhost:3000` in your browser.

### Manual Installation

Requirements:
- Node.js 20+
- pnpm 8+

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start the server
pnpm start
```

For development with hot reload:

```bash
pnpm dev
```

## Usage

1. **First Launch**: Authorize the extension in Roon Settings → Extensions
2. **Open Browser**: Navigate to `http://<server-ip>:3000`
3. **Select Zone**: Choose which zone to display
4. **Enjoy**: The display will update in real-time

### URL Parameters

- `?zone=<name>` - Auto-select zone by name (e.g., `?zone=Living%20Room`)
- `?layout=<type>` - Set layout: `detailed`, `minimal`, or `fullscreen`

Example: `http://localhost:3000/?zone=Office&layout=minimal`

### Interactions

- **Single Click**: Cycle through layouts
- **Double Click**: Change zone

## Layouts

| Layout | Description |
|--------|-------------|
| `detailed` | Artwork, title, artist, album, progress bar |
| `minimal` | Full-bleed artwork with title overlay |
| `fullscreen` | Artwork only (ambient mode) |

## Configuration

Environment variables (or `.env` file):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `HOST` | `0.0.0.0` | Server bind address |
| `ARTWORK_CACHE_DIR` | `./cache` | Artwork cache directory |
| `LOG_LEVEL` | `info` | Log level: `debug`, `info`, `warn`, `error` |

## API

### HTTP Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/zones` | List available zones |
| `GET` | `/api/artwork/:key` | Get cached/proxied artwork |
| `GET` | `/api/health` | Health check |

### WebSocket

Connect to `/ws` for real-time updates.

**Client → Server:**
```json
{ "type": "subscribe", "zone_id": "..." }
{ "type": "unsubscribe" }
```

**Server → Client:**
```json
{ "type": "zones", "zones": [...] }
{ "type": "now_playing", "zone_id": "...", "state": "playing", "track": {...}, "seek_position": 0 }
{ "type": "seek", "zone_id": "...", "seek_position": 42 }
```

## Development

```bash
# Run in development mode (server + client with hot reload)
pnpm dev

# Run tests
pnpm test

# Type check
pnpm typecheck

# Build for production
pnpm build
```

## Project Structure

```
roon-screen-cover/
├── packages/
│   ├── shared/          # Shared TypeScript types
│   ├── server/          # Node.js backend
│   │   └── src/
│   │       ├── index.ts      # Entry point
│   │       ├── roon.ts       # Roon API client
│   │       ├── websocket.ts  # WebSocket handling
│   │       └── artwork.ts    # Artwork cache
│   └── client/          # Vue 3 frontend
│       └── src/
│           ├── App.vue
│           ├── components/
│           ├── layouts/
│           └── composables/
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## License

MIT
