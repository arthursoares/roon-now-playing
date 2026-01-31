# Facts Layout Design

**Date:** 2026-01-31
**Status:** Approved
**Branch:** `feature/facts-layout`

## Overview

Add three new layout types that display LLM-generated interesting facts about the currently playing song, album, or artist. Facts rotate automatically during playback and are cached to minimize API costs.

## Layout Types

Three separate layouts added to the main picker:

### 1. Facts (Two-column) — `facts-columns`
- Album artwork on left (55%), facts panel on right (45%)
- Clean separation, similar to Ambient layout
- Best for: Large displays, easy reading from distance

### 2. Facts (Overlay) — `facts-overlay`
- Full-width album artwork with gradient lower-third
- Facts appear as cinematic text overlay on the art
- Best for: Art-focused displays, immersive viewing

### 3. Facts (Carousel) — `facts-carousel`
- Blurred album art as full background
- Centered card with current fact, slides/fades between facts
- Best for: Modern aesthetic, facts as the hero element

### Shared Behavior

All three layouts:
- Use the same facts-fetching logic (server-side LLM integration)
- Share caching behavior
- Respect the existing `BackgroundType` setting
- Use the existing font setting
- Auto-rotate facts (8-30 seconds based on reading time)
- Fade transitions between facts (500ms)
- Show dot indicators for position in fact sequence
- Stack vertically on mobile (artwork top, facts bottom)

## Facts Display Behavior

### Rotation Timing

- Calculate reading time: `wordCount × 250ms` (average reading speed)
- Add visual absorption padding: `+3 seconds`
- Clamp between 8-30 seconds per fact
- Rotation pauses when track is paused, resumes when playing
- Resets to first fact when track changes

### State Flow

1. **Track changes** → Show track info (title, artist, album) immediately
2. **Facts loading** → Track info remains visible, subtle loading indicator
3. **Facts arrive** → Crossfade from track info to first fact
4. **Facts rotate** → Fade transition between facts with dot indicators

### Error Handling

| Scenario | Behavior |
|----------|----------|
| No API key configured | Show "Configure API key in Admin" message with link |
| LLM API error/timeout | Show track info + "Facts unavailable" with retry option |
| LLM returns empty/invalid | Keep showing track info (graceful degradation) |
| Network error | Show cached facts if available, otherwise track info |

### Caching Strategy

**Server-side:**
- File-backed cache at `./config/facts-cache.json`
- Keyed by `artist::album::title` (normalized to lowercase)
- 72-hour TTL
- Survives server restarts

**Client-side:**
- SessionStorage for current session
- Prevents re-fetching same track within session

### Fact Content

- Balanced mix of recording/production, cultural/historical, and personal stories
- LLM decides what's most interesting per track
- Inline attribution encouraged (e.g., "In a 1985 interview..." or "According to Songfacts...")
- No formal disclaimer required

## Admin Panel Configuration

New collapsible section: **"Facts Layout Configuration"**

### Settings

| Setting | Description |
|---------|-------------|
| LLM Provider | Dropdown: Anthropic, OpenAI |
| Model | Dynamic based on provider (Claude Sonnet/Haiku, GPT-4o/4o-mini) |
| API Key | Input field with show/hide toggle, or use environment variable |
| Facts per track | Number input (default: 5) |
| Rotation interval | Fallback interval in seconds (default: 25) |
| Custom Prompt | Textarea (hidden under "Advanced" toggle) |

### Test Configuration

Two options for testing:
1. **"Test with current track"** button — uses whatever is currently playing
2. **Manual input** — Artist, Album, Title fields for custom testing

Test results display:
- Success: Shows generated facts with timing info
- Error: Shows error message with details

### Config Persistence

Stored in `./config/facts-config.json`:
```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "apiKey": "sk-ant-...",
  "factsCount": 5,
  "rotationInterval": 25,
  "prompt": "..."
}
```

API key can alternatively be set via environment variable (`ANTHROPIC_API_KEY` or `OPENAI_API_KEY`), which takes precedence over config file.

## Server Architecture

### New Files

| File | Purpose |
|------|---------|
| `packages/server/src/llm.ts` | LLM provider abstraction (Anthropic/OpenAI) |
| `packages/server/src/facts.ts` | Facts API router |
| `packages/server/src/factsConfig.ts` | Config management (read/write JSON) |
| `packages/server/src/factsCache.ts` | File-backed cache with TTL |

### LLM Provider Abstraction

```typescript
interface LLMProvider {
  generateFacts(artist: string, album: string, title: string): Promise<string[]>;
}

class AnthropicProvider implements LLMProvider { ... }
class OpenAIProvider implements LLMProvider { ... }
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/facts` | POST | Get facts for a track (cached or new) |
| `/api/facts/config` | GET | Get current facts configuration |
| `/api/facts/config` | POST | Update facts configuration |
| `/api/facts/test` | POST | Test LLM with provided track info |

### Request/Response Types

```typescript
// POST /api/facts
interface FactsRequest {
  artist: string;
  album: string;
  title: string;
}

interface FactsResponse {
  facts: string[];
  cached: boolean;
  generatedAt: number;
}

// POST /api/facts/test
interface FactsTestRequest {
  artist: string;
  album: string;
  title: string;
}

interface FactsTestResponse {
  facts: string[];
  durationMs: number;
}
```

## Client Architecture

### New Files

| File | Purpose |
|------|---------|
| `packages/client/src/layouts/FactsColumnsLayout.vue` | Two-column facts layout |
| `packages/client/src/layouts/FactsOverlayLayout.vue` | Overlay style layout |
| `packages/client/src/layouts/FactsCarouselLayout.vue` | Carousel card style layout |
| `packages/client/src/composables/useFacts.ts` | Facts fetching/state management |

### Shared Types Update

```typescript
// packages/shared/src/index.ts
export const LAYOUTS = [
  'detailed', 'minimal', 'fullscreen', 'ambient', 'cover',
  'facts-columns', 'facts-overlay', 'facts-carousel'
] as const;

export interface FactsRequest {
  artist: string;
  album: string;
  title: string;
}

export interface FactsResponse {
  facts: string[];
  cached: boolean;
  generatedAt: number;
}

export type FactsErrorType = 'no-key' | 'api-error' | 'empty';

export interface FactsError {
  type: FactsErrorType;
  message: string;
}
```

### useFacts Composable

```typescript
function useFacts(track: Ref<Track | null>): {
  facts: Ref<string[]>;
  currentFactIndex: Ref<number>;
  currentFact: ComputedRef<string | null>;
  isLoading: Ref<boolean>;
  error: Ref<FactsError | null>;
  cached: Ref<boolean>;
}
```

**Behavior:**
- Watches track changes, debounces 500ms (handles rapid skipping)
- Fetches from `/api/facts` endpoint
- Manages auto-rotation timer internally
- Pauses rotation when `state !== 'playing'`
- Stores fetched facts in sessionStorage as client-side cache
- Exposes error type so layouts can render appropriate UI

### Layout Components

All three layout components:
- Accept standard `LayoutProps` (same as other layouts)
- Use `useFacts` composable for facts state
- Use `useColorExtraction` when background type requires it
- Handle all states: loading, facts display, error states

## Files to Modify

| File | Change |
|------|--------|
| `packages/shared/src/index.ts` | Add 3 layout types, add Facts-related interfaces |
| `packages/client/src/components/NowPlaying.vue` | Import and register 3 facts layout components |
| `packages/client/src/views/AdminView.vue` | Add "Facts Configuration" collapsible section |
| `packages/server/src/index.ts` | Register facts API router |
| `.env.example` | Add `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` |

## Dependencies

### New NPM Packages (Server)

- `@anthropic-ai/sdk` — Anthropic Claude API client
- `openai` — OpenAI API client

## Default Prompt Template

```
Generate {factsCount} interesting, lesser-known facts about this music:

Artist: {artist}
Album: {album}
Track: {title}

Focus on:
- Recording history or interesting production details
- Historical context or cultural impact
- Connections to other artists or musical movements
- Awards, chart positions, or notable achievements
- Personal stories from the artist about this work

When possible, include attribution (e.g., "In a 1985 interview..." or "According to Songfacts...").

Keep each fact concise (2-3 sentences max). Prioritize surprising or educational information over common knowledge.

Return ONLY a JSON array of strings, no other text.
```

**Variables:**
- `{artist}` — Artist/band name from track metadata
- `{album}` — Album name from track metadata
- `{title}` — Song title from track metadata
- `{factsCount}` — Configured number of facts (default: 5)

## Mobile Behavior

All facts layouts stack vertically on screens < 900px:
- Album artwork on top
- Facts panel below
- Follows the same pattern as Ambient layout

## Out of Scope (Future Enhancements)

- Manual fact navigation (tap to advance)
- Pre-fetch facts for next track in queue
- User rating/feedback on facts quality
- Wikipedia/MusicBrainz fallback data sources
- Streaming facts display (show as they generate)
