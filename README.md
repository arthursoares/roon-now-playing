# Roon Now Playing

A now-playing display for Roon and other music sources. Shows real-time album artwork and track metadata on any web-connected client. Perfect for "always-on" displays like tablets and wall-mounted screens. Works with Roon, or in external-sources-only mode via API.

<p align="center">
  <img width="3108" height="2090" alt="CleanShot 2026-02-01 at 23 09 09@2x" src="https://github.com/user-attachments/assets/11b2f27e-5bbb-415c-a9be-0d5e7431f854" />
</p>

## Features

- Real-time album artwork and track metadata display
- Multiple simultaneous clients viewing different zones
- Eleven display layouts including Album Wall, Album Gallery, and AI-powered Facts layouts
- Fourteen background options with dynamic color extraction
- Seventeen customizable font families
- AI-generated facts about currently playing music (Anthropic/OpenAI/OpenRouter/Local LLM)
- **Self-service onboarding** — displays auto-generate friendly names and show QR codes linking to per-screen config
- **Kiosk tap lock** — disable layout taps and zone double-taps per display from Admin or its screen configuration; Smart Idle wake gestures remain available
- Admin panel for managing connected clients and AI configuration
- **Roon optional** — set `ROON_ENABLED=false` to run in external-sources-only mode, no Roon required
- **External Sources API** for non-Roon music sources (see [External API Documentation](docs/external-api.md))
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

1. **First Launch**: Open `http://<server-ip>:3000` on your display
2. **Welcome Screen**: The display auto-generates a friendly name (e.g., `gentle-fox-17`) and shows a QR code
3. **Configure**: Scan the QR code from your phone to open the screen's config page, or visit `/admin`
4. **Select Zone**: Choose which zone to display (Roon zones auto-appear; external sources via API)
5. **Enjoy**: The display will update in real-time

> **Tip:** If using Roon, authorize the extension in Roon Settings → Extensions. To run without Roon, set `ROON_ENABLED=false` in your environment.

### URL Parameters

| Parameter | Values | Description |
|-----------|--------|-------------|
| `zone` | Zone name or ID | Auto-select zone (e.g., `?zone=Living%20Room`) |
| `layout` | `detailed`, `minimal`, `fullscreen`, `ambient`, `cover`, `facts-columns`, `facts-overlay`, `facts-carousel`, `basic`, `album-wall`, `album-gallery` | Display layout |
| `background` | See [Backgrounds](#backgrounds) section | Background style |
| `font` | See [Fonts](#fonts) section | Font family |

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
| `facts-carousel` | Blurred artwork background with the rotating fact shown as large type, plus a compact now-playing chip. Sized for legibility on TVs. |
| `basic` | Legacy-compatible layout for older browsers (iOS 12+). Artwork with title, artist, album, and progress bar. Auto-adapts to portrait/landscape. |
| `album-wall` | A prominent current album with a gallery of recent albums from the selected zone. History persists across restarts and supports Roon and external sources. |
| `album-gallery` | Covers-only mosaic using up to 12 recent albums. Square artwork repeats to fill a dense screen-wide grid; the viewport clips the outer tiles. |

**Note:** Facts layouts require an LLM provider configured in the Admin panel. Supported providers: Anthropic, OpenAI, OpenRouter, or Local LLM (Ollama/LM Studio).

**Note:** The `basic` layout is designed for older browsers like iOS 12 Safari. It avoids modern CSS features (gap, aspect-ratio, backdrop-filter) for maximum compatibility on legacy devices used as dedicated displays.

### Album Wall and Album Gallery

Choose **Album wall** in screen configuration or open `/?layout=album-wall`.
The server retains the 12 most recent distinct artist/album pairs for each zone,
including the current album, in `DATA_DIR/album-history.json`. Consecutive tracks
from one album share a single entry; returning to an older album moves it to the
front. History gathers as the server observes playback, including when no display
is connected. Paused/stopped updates and tracks without album metadata do not add
entries. Missing or unavailable covers show placeholders.

Choose **Album gallery** or `/?layout=album-gallery` for a covers-only mosaic,
without a header, captions, or badges. Each image stays intact within its square
tile; the centered mosaic extends beyond the viewport so only the screen edges
clip the outer covers. The arrangement adapts to screen shape and cycles shorter
histories through at least 40 visual slots. Each distinct album appears once in
accessible labels and hover titles; repeated visual tiles are hidden from
assistive technology.

Album Wall retains its artwork-derived backgrounds and metadata. Its track
titles stop at three lines, with ellipsis for artist and album labels. Dynamic
backgrounds receive a dark content layer to keep that text readable; there is
no automatic scrolling text.

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
| `inter` | Inter - Modern UI font, highly legible |
| `roboto` | Roboto - Google's signature font |
| `open-sans` | Open Sans - Friendly and neutral |
| `lato` | Lato - Warm and stable |
| `montserrat` | Montserrat - Geometric elegance |
| `poppins` | Poppins - Clean geometric sans |
| `source-sans-3` | Source Sans 3 - Adobe's open source font |
| `nunito` | Nunito - Rounded and balanced |
| `raleway` | Raleway - Elegant thin weight |
| `work-sans` | Work Sans - Optimized for screens |

## Admin Panel

Access the admin panel at `/admin` to manage connected clients and configure AI features.

### Self-Service Onboarding
New displays automatically receive a memorable name (e.g., `calm-falcon-7`) and show a QR code linking to `/admin/screen/<name>`. Scanning the QR from a phone opens a focused config page for that specific display — no manual ID lookup needed.

### Per-Screen Config (`/admin/screen/:name`)
A mobile-friendly page for configuring a single display:
- Rename the screen
- Select zone
- Change layout, background, and font
- Settings are pushed to the display in real-time

### Client Management
- View all connected clients with their current settings
- Push layout, font, background, and zone changes to any client remotely
- Auto-generated friendly names (admin can rename anytime)
- Real-time updates when clients connect/disconnect

### Smart Idle and Night Dimming

Global Display Settings can show a clock, black screen, or chosen display layout after the selected zone has been paused or stopped for 1–60 minutes. Smart Idle is off by default, wakes temporarily on touch or key input, and returns to the user's normal layout as soon as playback resumes. The temporary idle layout does not change the display's saved layout preference.

Optional night dimming reduces the brightness of the web page during a schedule evaluated in each display's local time, including schedules that cross midnight. It adds a dark page overlay; it does not change physical screen brightness or device power.

### Facts Configuration
Configure AI-powered facts generation for the facts layouts:
- Choose from four providers: Anthropic, OpenAI, OpenRouter, or Local LLM
- Select model from curated list or enter custom model name
- Set API key (or use environment variables)
- Configure local LLM base URL for Ollama/LM Studio
- Configure facts count per track (1-10)
- Set maximum output tokens in Advanced Settings (1–65,536; default 1,024). Provider and model limits still apply.
- Customize rotation interval
- Test configuration with sample track data

## Configuration

Environment variables (or `.env` file):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `HOST` | `0.0.0.0` | Server bind address |
| `ROON_ENABLED` | `true` | Set to `false` to disable Roon and run in external-sources-only mode |
| `DATA_DIR` | `./config` | Directory for persistent config (Roon state, client names, etc.) |
| `ARTWORK_CACHE_DIR` | `./cache` | Artwork cache directory |
| `LOG_LEVEL` | `info` | Log level: `debug`, `info`, `warn`, `error` |
| `ANTHROPIC_API_KEY` | - | Anthropic API key for facts generation |
| `OPENAI_API_KEY` | - | OpenAI API key for facts generation |
| `OPENROUTER_API_KEY` | - | OpenRouter API key for facts generation |
| `LOCAL_LLM_URL` | `http://localhost:11434/v1` | Base URL for local LLM (Ollama/LM Studio) |

**Note:** API keys can also be configured via the Admin panel. Environment variables take precedence.

## LLM Providers

The facts feature supports multiple LLM providers for generating music facts:

### Anthropic (Default)
- Models: Claude Haiku 4.5 (default), Claude Sonnet 4.6, Claude Opus 4.8
- Requires: `ANTHROPIC_API_KEY` or API key in Admin panel
- Best for: High-quality, nuanced facts

### OpenAI
- Models: GPT-5, GPT-5-mini, GPT-5-nano, GPT-4.1, GPT-4o, GPT-4o-mini
- Requires: `OPENAI_API_KEY` or API key in Admin panel
- Best for: Fast, reliable generation
- Note: GPT-5 / o-series reasoning models are sent `max_completion_tokens` (not the legacy `max_tokens`)

### OpenRouter
- Access 200+ models through a unified API
- Curated models: Claude Sonnet 4.5, GPT-4.1, Gemini 2.5 Flash, Llama 3.3, DeepSeek
- Custom model support: Enter any OpenRouter model ID
- Requires: `OPENROUTER_API_KEY` or API key in Admin panel
- Best for: Model variety, cost optimization
- Get an API key at [openrouter.ai](https://openrouter.ai)

### Local LLM (Ollama/LM Studio)
- Run models locally with no API costs
- Works with any OpenAI-compatible local server
- Requires: Local server running (e.g., Ollama, LM Studio)
- Configure base URL in Admin panel or via `LOCAL_LLM_URL`
- API key optional (only if your local server requires it)
- Best for: Privacy, offline use, cost savings

**Ollama Quick Start:**
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3.1

# Ollama runs on http://localhost:11434/v1 by default
```

**LM Studio Quick Start:**
1. Download LM Studio from [lmstudio.ai](https://lmstudio.ai)
2. Download a model (e.g., Llama 3.1, Mistral)
3. Start local server (default: `http://localhost:1234/v1`)
4. Configure the URL in Admin panel

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
| `GET` | `/api/admin/screens/:name` | Get screen by friendly name |
| `GET` | `/api/admin/display-settings` | Get global display and Smart Idle settings |
| `POST` | `/api/admin/display-settings` | Partially update global display and Smart Idle settings |

### Facts API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/facts/config` | Get current facts configuration |
| `POST` | `/api/facts/config` | Update facts configuration |
| `POST` | `/api/facts` | Get or generate facts using artist, album, and title in the JSON body |
| `POST` | `/api/facts/test` | Test facts generation with sample data |

Facts generation errors return a non-success status and an `error` object with
`type` and `message`. Unusable model output returns 502. Displays retain their
artwork and track metadata and show an error message; failed responses are not
cached. Local models can generate facts without an API key on both endpoints.

The parser recovers explicitly supported array-formatting mistakes, including
missing separators and structural curly quotes. Ambiguous quotation, incomplete
facts, and mixed JSON schemas are rejected rather than displayed as fragments.

### External Sources API

The External Sources API allows any music source to push now-playing data. External sources appear as zones alongside Roon zones.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/sources/:zoneId/now-playing` | Push now-playing update |
| `DELETE` | `/api/sources/:zoneId` | Remove external zone |
| `GET` | `/api/sources` | List external zones |
| `GET` | `/api/sources/config` | Get API configuration |
| `POST` | `/api/sources/config` | Update API configuration |

For complete documentation with examples, see [External API Documentation](docs/external-api.md).

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

### Visual testing & approval matrix

UI work is reviewed against screenshots, not just code. The **approved review
resolutions** are the only ones that need sign-off:

| Scenario | Resolution |
|----------|-----------|
| iPad (landscape) | 1194 × 834 |
| TV 1080p | 1920 × 1080 |
| TV 4K | 3840 × 2160 |

```bash
# Approval matrix: every layout × every background type (JPEG frames).
# Scope to specific layouts with MATRIX_LAYOUTS (CI does this automatically):
pnpm test:e2e:matrix
MATRIX_LAYOUTS=detailed,basic pnpm test:e2e:matrix

# Contact sheets: one image per layout showing all 14 backgrounds (needs ImageMagick).
# This is the lightweight review surface that CI uploads / posts back.
pnpm run review:pack         # → e2e/screenshots/matrix/_review/<res>/<layout>.jpg

# Interactive gallery: browse every frame, click to flag ones that need review,
# copy the exported list.
pnpm run review:gallery      # → e2e/screenshots/matrix/gallery.html (open in a browser)
```

**Manual triage — `gallery.html`** tiles the rendered frames by resolution and
layout; click any that need attention (with an optional note) and the export
drawer gives you a copy-paste list like `facts-carousel / white @ TV-1080p — text
unreadable`. Selections persist in the browser.

**Model-assisted audit** — hand the contact sheets in
`e2e/screenshots/matrix/_review/` plus [`e2e/visual-review-prompt.md`](e2e/visual-review-prompt.md)
to a vision-capable model for a ranked findings table.

#### CI: selective by default, full on demand

The `Visual Approval Matrix` workflow is intentionally **not** run on every PR:

- **On PRs** it triggers only when UI-affecting paths change, and renders **only
  the layouts the PR touched** (global changes — design tokens, shared types,
  background/color composables — render the full set). It uploads the small
  contact-sheet `visual-review-pack` artifact and posts a sticky PR comment.
- **Full run on demand:** Actions → *Visual Approval Matrix* → *Run workflow*
  (optionally scope to specific layouts).

Frames are JPEG and only the montages are uploaded (not raw frames or the HTML
report), so the artifact stays in the low-MB range. Mock playback uses the
bundled `assets/artwork_radiohead-in_rainbows.jpg` cover so palette-extracted
gradients render true to production.

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
│   │       ├── websocket.ts    # WebSocket handling
│   │       ├── artwork.ts      # Artwork cache
│   │       ├── admin.ts        # Admin API routes
│   │       ├── nameGenerator.ts # Friendly name generator
│   │       └── clientNames.ts  # Persistent name storage
│   └── client/              # Vue 3 frontend
│       └── src/
│           ├── views/
│           │   ├── NowPlayingView.vue
│           │   ├── AdminView.vue
│           │   └── ScreenConfigView.vue
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
│           │   ├── FactsCarouselLayout.vue
│           │   └── BasicLayout.vue
│           └── composables/
│               ├── useWebSocket.ts
│               ├── usePreferences.ts
│               ├── useColorExtraction.ts
│               ├── useBackgroundStyle.ts
│               ├── useFacts.ts
│               └── colorUtils.ts
├── .github/workflows/
│   ├── docker-publish.yml
│   └── visual-matrix.yml    # PR visual approval matrix
├── e2e/                     # Playwright visual tests (matrix + constraints)
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
docker pull ghcr.io/arthursoares/roon-now-playing:1.10.0
```

Supported platforms:
- `linux/amd64`
- `linux/arm64`

## License

MIT
