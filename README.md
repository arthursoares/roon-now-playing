# Roon Now Playing

A Roon extension that displays real-time album artwork and track metadata on any web-connected client. Perfect for "always-on" displays like tablets and wall-mounted screens.

## Features

- Real-time album artwork and track metadata display
- Multiple simultaneous clients viewing different zones
- Five display layouts: Detailed, Minimal, Fullscreen, Ambient, and Cover
- Customizable fonts via URL parameter
- Admin panel for managing connected clients
- Automatic zone selection via URL parameters
- WebSocket-based real-time updates
- Artwork caching for performance
- Auto-reconnect on connection loss
- Multi-platform Docker images (amd64, arm64)

## Quick Start

### Docker (Recommended)

```bash
docker compose up -d
```

Or pull the image directly:

```bash
docker pull ghcr.io/arthursoares/roon-now-playing:latest
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
- `?layout=<type>` - Set layout: `detailed`, `minimal`, `fullscreen`, `ambient`, or `cover`
- `?font=<type>` - Set font style (see Fonts section)

Example: `http://localhost:3000/?zone=Office&layout=minimal&font=serif`

### Interactions

- **Single Click**: Cycle through layouts
- **Double Click**: Change zone

## Layouts

| Layout | Description |
|--------|-------------|
| `detailed` | Artwork, title, artist, album, progress bar |
| `minimal` | Full-bleed artwork with title overlay |
| `fullscreen` | Clean full-screen artwork with subtle track info |
| `ambient` | Artwork only, no text overlays |
| `cover` | Album cover centered on screen |

## Fonts

Customize the display font using the `?font=` URL parameter:

| Font | Description |
|------|-------------|
| `sans` | Clean sans-serif (default) |
| `serif` | Classic serif typeface |
| `mono` | Monospace/terminal style |
| `display` | Decorative display font |

## Admin Panel

Access the admin panel at `/admin` to manage connected clients.

Features:
- View all connected clients with their current zone and layout
- Push settings (layout, font, zone) to any client remotely
- Set friendly names for clients for easy identification

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

### Admin API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/clients` | List all connected clients |
| `GET` | `/api/admin/zones` | List available zones |
| `POST` | `/api/admin/clients/:id/name` | Set client friendly name |
| `POST` | `/api/admin/clients/:id/push` | Push settings to client |

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
{ "type": "push_settings", "layout": "minimal", "font": "serif", "zoneId": "..." }
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

# Build Docker image locally
docker compose -f docker-compose.dev.yml up --build
```

## Project Structure

```
roon-now-playing/
├── packages/
│   ├── shared/          # Shared TypeScript types
│   ├── server/          # Node.js backend
│   │   └── src/
│   │       ├── index.ts      # Entry point
│   │       ├── roon.ts       # Roon API client
│   │       ├── websocket.ts  # WebSocket handling
│   │       ├── artwork.ts    # Artwork cache
│   │       └── admin.ts      # Admin API routes
│   └── client/          # Vue 3 frontend
│       └── src/
│           ├── App.vue
│           ├── router.ts
│           ├── views/
│           │   ├── NowPlayingView.vue
│           │   └── AdminView.vue
│           ├── components/
│           ├── layouts/
│           │   ├── DetailedLayout.vue
│           │   ├── MinimalLayout.vue
│           │   ├── FullscreenLayout.vue
│           │   ├── AmbientLayout.vue
│           │   └── CoverLayout.vue
│           └── composables/
├── .github/
│   └── workflows/
│       └── docker-publish.yml
├── Dockerfile
├── docker-compose.yml
├── docker-compose.dev.yml
└── README.md
```

## Docker Images

Pre-built images are available from GitHub Container Registry:

```bash
# Latest from main branch
docker pull ghcr.io/arthursoares/roon-now-playing:latest

# Specific version
docker pull ghcr.io/arthursoares/roon-now-playing:1.0.0
```

Supported platforms:
- `linux/amd64`
- `linux/arm64`

## License

MIT
