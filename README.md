# Roon Now Playing

A Roon extension that displays real-time album artwork and track metadata on any web-connected client. Perfect for "always-on" displays like tablets and wall-mounted screens.

<p align="center">
  <img src="assets/example03.jpeg" alt="Minimal Layout" width="800">
</p>

## Features

- Real-time album artwork and track metadata display
- Multiple simultaneous clients viewing different zones
- Eight display layouts including AI-powered Facts layouts
- Fourteen background options with dynamic color extraction
- Seven customizable font families
- AI-generated facts about currently playing music (Anthropic/OpenAI)
- Admin panel for managing connected clients and AI configuration
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

| Parameter | Values | Description |
|-----------|--------|-------------|
| `zone` | Zone name or ID | Auto-select zone (e.g., `?zone=Living%20Room`) |
| `layout` | `detailed`, `minimal`, `fullscreen`, `ambient`, `cover`, `facts-columns`, `facts-overlay`, `facts-carousel` | Display layout |
| `background` | See [Backgrounds](#backgrounds) section | Background style |
| `font` | `system`, `patua-one`, `comfortaa`, `noto-sans-display`, `coda`, `bellota-text`, `big-shoulders` | Font family |

Example: `http://localhost:3000/?zone=Office&layout=detailed&background=gradient-mesh&font=comfortaa`

### Interactions

- **Single Click**: Cycle through layouts
- **Double Click**: Change zone

## Layouts

| Layout | Description |
|--------|-------------|
| `detailed` | Album artwork alongside title, artist, album, and progress bar. Responsive two-column layout on wider screens. |
| `minimal` | Full-bleed artwork covering the entire screen with title/artist overlay at the bottom. Background setting is ignored. |
| `fullscreen` | Album artwork centered on screen, scaled to fit. No text overlays. |
| `ambient` | Color-extracted background with artwork and full track info. Great for 10-foot UI / TV displays. |
| `cover` | Clean album cover centered with subtle shadow. Artwork crossfades on track changes. |
| `facts-columns` | Two-column layout with artwork and AI-generated facts about the music. |
| `facts-overlay` | Full artwork background with facts overlaid at the bottom. |
| `facts-carousel` | Blurred artwork background with facts displayed in a centered card. |

**Note:** Facts layouts require an API key (Anthropic or OpenAI) configured in the Admin panel.

### Screenshots

<table>
  <tr>
    <td align="center"><img src="assets/example01.jpeg" alt="Detailed with Dominant Color" width="400"><br><em>Detailed + Dominant Color</em></td>
    <td align="center"><img src="assets/example02.jpeg" alt="Detailed with White Background" width="400"><br><em>Detailed + White</em></td>
  </tr>
  <tr>
    <td align="center"><img src="assets/example05.jpeg" alt="Detailed with Warm Colors" width="400"><br><em>Detailed + Dominant Color</em></td>
    <td align="center"><img src="assets/example04.jpeg" alt="Cover with Gradient" width="400"><br><em>Cover + Radial Gradient</em></td>
  </tr>
</table>

## Backgrounds

Customize the background using the `?background=` URL parameter or via Admin UI:

### Basic
| Background | Description |
|------------|-------------|
| `black` | Pure black (#000000) - Default |
| `white` | Pure white (#ffffff) |
| `dominant` | Vibrant solid color extracted from album artwork |

### Gradients
| Background | Description |
|------------|-------------|
| `gradient-radial` | Radial gradient emanating from center using artwork colors |
| `gradient-linear` | Diagonal linear gradient (135°) using artwork colors |
| `gradient-linear-multi` | Multi-color linear gradient using full color palette |
| `gradient-radial-corner` | Radial gradient from corner using palette colors |
| `gradient-mesh` | CSS mesh gradient with colors at corners |

### Artwork-Based
| Background | Description |
|------------|-------------|
| `blur-subtle` | Softly blurred album artwork (20px blur) |
| `blur-heavy` | Heavily blurred album artwork (50px blur) |
| `duotone` | Album artwork with two-color duotone effect |
| `posterized` | Album artwork with reduced color posterization |

### Textured
| Background | Description |
|------------|-------------|
| `gradient-noise` | Gradient with subtle noise texture overlay |
| `blur-grain` | Blurred artwork with film grain effect |

**Note:** The `minimal` layout ignores background settings since the artwork covers the entire screen.

## Fonts

Customize the display font using the `?font=` URL parameter:

| Font | Description |
|------|-------------|
| `system` | System default font (default) |
| `patua-one` | Patua One - Bold slab serif |
| `comfortaa` | Comfortaa - Rounded geometric sans |
| `noto-sans-display` | Noto Sans Display - Clean sans-serif |
| `coda` | Coda - Friendly sans-serif |
| `bellota-text` | Bellota Text - Soft humanist sans |
| `big-shoulders` | Big Shoulders Display - Condensed display |

## Admin Panel

Access the admin panel at `/admin` to manage connected clients and configure AI features.

### Client Management
- View all connected clients with their current settings
- Push layout, font, background, and zone changes to any client remotely
- Set friendly names for clients for easy identification
- Real-time updates when clients connect/disconnect

### Facts Configuration
Configure AI-powered facts generation for the facts layouts:
- Choose between Anthropic (Claude) or OpenAI providers
- Select model (e.g., claude-sonnet-4, gpt-4o)
- Set API key (or use environment variables)
- Configure facts count per track (1-10)
- Customize rotation interval
- Test configuration with sample track data

## Configuration

Environment variables (or `.env` file):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `HOST` | `0.0.0.0` | Server bind address |
| `ARTWORK_CACHE_DIR` | `./cache` | Artwork cache directory |
| `LOG_LEVEL` | `info` | Log level: `debug`, `info`, `warn`, `error` |
| `ANTHROPIC_API_KEY` | - | Anthropic API key for facts generation |
| `OPENAI_API_KEY` | - | OpenAI API key for facts generation |

**Note:** API keys can also be configured via the Admin panel. Environment variables take precedence.

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
| `POST` | `/api/admin/clients/:id/push` | Push settings to client (layout, font, background, zoneId) |

### Facts API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/facts/config` | Get current facts configuration |
| `POST` | `/api/facts/config` | Update facts configuration |
| `GET` | `/api/facts/:artist/:album/:title` | Get cached facts for a track |
| `POST` | `/api/facts/test` | Test facts generation with sample data |

### WebSocket

Connect to `/ws` for real-time updates.

**Client → Server:**
```json
{ "type": "subscribe", "zone_id": "..." }
{ "type": "unsubscribe" }
{ "type": "client_metadata", "clientId": "...", "layout": "detailed", "font": "system", "background": "black", ... }
```

**Server → Client:**
```json
{ "type": "zones", "zones": [...] }
{ "type": "now_playing", "zone_id": "...", "state": "playing", "track": {...}, "seek_position": 0 }
{ "type": "seek", "zone_id": "...", "seek_position": 42 }
{ "type": "remote_settings", "layout": "minimal", "font": "comfortaa", "background": "gradient-radial" }
```

## Contributing

### Adding a New Layout

Layouts are Vue 3 single-file components in `packages/client/src/layouts/`. To create a new layout:

1. **Create the layout component** at `packages/client/src/layouts/YourLayout.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import type { Track, PlaybackState, BackgroundType } from '@roon-screen-cover/shared';
import { useColorExtraction } from '../composables/useColorExtraction';
import { useBackgroundStyle } from '../composables/useBackgroundStyle';

const props = defineProps<{
  track: Track | null;
  state: PlaybackState;
  isPlaying: boolean;
  progress: number;
  currentTime: string;
  duration: string;
  artworkUrl: string | null;
  zoneName: string;
  background: BackgroundType;
}>();

// Optional: Use color extraction for dynamic backgrounds
const backgroundRef = computed(() => props.background);
const artworkUrlRef = computed(() => props.artworkUrl);
const { colors, vibrantGradient } = useColorExtraction(artworkUrlRef);
const { style: backgroundStyle } = useBackgroundStyle(backgroundRef, colors, vibrantGradient);
</script>

<template>
  <div class="your-layout" :style="backgroundStyle">
    <!-- Your layout design here -->
  </div>
</template>

<style scoped>
.your-layout {
  width: 100%;
  height: 100%;
  color: var(--text-color, #fff);
  transition: background 0.5s ease-out;
}
</style>
```

2. **Register the layout** in `packages/shared/src/index.ts`:

```typescript
export const LAYOUTS = ['detailed', 'minimal', 'fullscreen', 'ambient', 'cover', 'your-layout'] as const;
```

3. **Add to the layout switcher** in `packages/client/src/components/NowPlaying.vue`:

```typescript
import YourLayout from '../layouts/YourLayout.vue';

const layoutComponent = computed(() => {
  switch (props.layout) {
    // ... existing cases
    case 'your-layout':
      return YourLayout;
    default:
      return DetailedLayout;
  }
});
```

4. **Build and test**:

```bash
pnpm build
pnpm dev
# Open http://localhost:5173/?layout=your-layout
```

### Available Composables

| Composable | Purpose |
|------------|---------|
| `useColorExtraction(artworkUrl)` | Extract dominant colors from artwork for dynamic theming |
| `useBackgroundStyle(background, colors, vibrantGradient)` | Generate CSS styles for background types |
| `useNowPlaying(nowPlaying)` | Process now playing data with formatted times and progress |

### CSS Variables

When using `useBackgroundStyle`, these CSS variables are available:

| Variable | Description |
|----------|-------------|
| `--text-color` | Primary text color |
| `--text-secondary` | Secondary text color (80% opacity) |
| `--text-tertiary` | Tertiary text color (60% opacity) |
| `--progress-bar-bg` | Progress bar background |
| `--progress-bar-fill` | Progress bar fill color |

## Development

```bash
# Run in development mode (server + client with hot reload)
pnpm dev

# Type check
pnpm --filter @roon-screen-cover/client exec vue-tsc --noEmit

# Build for production
pnpm build

# Build Docker image locally
docker compose -f docker-compose.dev.yml up --build
```

## Project Structure

```
roon-now-playing/
├── packages/
│   ├── shared/              # Shared TypeScript types
│   │   └── src/index.ts     # Type definitions, constants
│   ├── server/              # Node.js backend
│   │   └── src/
│   │       ├── index.ts     # Entry point
│   │       ├── roon.ts      # Roon API client
│   │       ├── websocket.ts # WebSocket handling
│   │       ├── artwork.ts   # Artwork cache
│   │       └── admin.ts     # Admin API routes
│   └── client/              # Vue 3 frontend
│       └── src/
│           ├── views/
│           │   ├── NowPlayingView.vue
│           │   └── AdminView.vue
│           ├── components/
│           │   ├── NowPlaying.vue
│           │   ├── ZonePicker.vue
│           │   └── ProgressBar.vue
│           ├── layouts/
│           │   ├── DetailedLayout.vue
│           │   ├── MinimalLayout.vue
│           │   ├── FullscreenLayout.vue
│           │   ├── AmbientLayout.vue
│           │   ├── CoverLayout.vue
│           │   ├── FactsColumnsLayout.vue
│           │   ├── FactsOverlayLayout.vue
│           │   └── FactsCarouselLayout.vue
│           └── composables/
│               ├── useWebSocket.ts
│               ├── usePreferences.ts
│               ├── useColorExtraction.ts
│               ├── useBackgroundStyle.ts
│               ├── useFacts.ts
│               └── colorUtils.ts
├── .github/workflows/
│   └── docker-publish.yml
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## Docker Images

Pre-built images are available from GitHub Container Registry:

```bash
# Latest from main branch
docker pull ghcr.io/arthursoares/roon-now-playing:latest

# Specific version
docker pull ghcr.io/arthursoares/roon-now-playing:1.3.0
```

Supported platforms:
- `linux/amd64`
- `linux/arm64`

## License

MIT
