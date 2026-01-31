# Implementation Plan: Facts Layout

## Plan Scope

| Scope | Value |
|-------|-------|
| Files | 6-8 files (new + modified) |
| Branch | `main` → new branch `feature/facts-layout` |
| Task | Add a new "facts" layout that displays LLM-generated interesting facts about the currently playing song, album, or artist alongside album artwork |

## Summary

Create a new layout type that leverages an LLM API (Anthropic or OpenAI) to generate and display interesting facts about the current track. The layout will feature a two-column design similar to the ambient layout: album artwork on one side, **auto-rotating facts slideshow** on the other. Facts (5-6 per track) will cycle automatically during playback with smart timing based on fact length. Facts are cached per track to minimize API costs.

## Important Note: API Authentication

### Option 1: API Keys (Recommended - Most Reliable)
- **Anthropic API key** (console.anthropic.com) - pay-per-token
- **OpenAI API key** (platform.openai.com) - pay-per-token
- With aggressive caching, costs are minimal (only charged for unique tracks)

### Option 2: Claude Pro/Max OAuth (Experimental - Limited Support)
As of January 2026, Anthropic has **tightened restrictions** on using Pro/Max subscription OAuth tokens outside of Claude Code CLI. While `claude setup-token` generates OAuth tokens (`sk-ant-oat01-...` format), these are now explicitly blocked for third-party API usage with the error: *"This credential is only authorized for use with Claude Code and cannot be used for other API requests."*

**Current status:** There's an open feature request ([#1454](https://github.com/anthropics/claude-code/issues/1454)) for machine-to-machine authentication with Max subscriptions, but no official third-party OAuth API exists yet.

**Recommendation:** Use standard API keys for reliability. We can add OAuth support later if Anthropic opens this up.

---

## Architecture Decision

### LLM Integration Approach: Server-Side (Recommended)

**Why server-side:**
1. **Security** - API keys stay on server, not exposed to clients
2. **Caching** - Server can cache facts per artist/album/track combo
3. **Rate limiting** - Server controls API usage across all clients
4. **Provider flexibility** - Easy to switch between Anthropic/OpenAI without client changes

**Data Source Strategy (Tiered Approach):**

| Priority | Source | Cost | Quality | Coverage |
|----------|--------|------|---------|----------|
| 1 | **Songfacts.com** | Paid API (contact for pricing) | Excellent - curated, verified | Good for popular songs |
| 2 | **Wikipedia API** | Free | Good - community-edited | Varies by song notability |
| 3 | **LLM Generation** | Pay-per-token | Good - but may hallucinate | Universal fallback |

**Recommended Implementation:**
- **Phase 1 (MVP):** LLM-only with smart prompting using search patterns
- **Phase 2:** Add Wikipedia API integration (free, structured data)
- **Phase 3:** Songfacts API if budget allows (best quality)

**LLM Provider Support:**
- Primary: Anthropic (Claude API)
- Secondary: OpenAI (GPT-4)
- Configuration via environment variables

---

## Files to Modify

| File | Change |
|------|--------|
| `packages/shared/src/index.ts` | Add `'facts'` to LAYOUTS array, add Facts-related types, add LLM config types |
| `packages/client/src/components/NowPlaying.vue` | Import and register FactsLayout component |
| `packages/client/src/views/AdminView.vue` | Add "Facts Configuration" section for LLM settings |
| `packages/server/src/index.ts` | Register facts API router, add config endpoints |
| `.env.example` | Add LLM API key configuration examples |

## Files to Create

| File | Purpose |
|------|---------|
| `packages/client/src/layouts/FactsLayout.vue` | New Vue component for facts display |
| `packages/client/src/composables/useFacts.ts` | Composable for fetching/caching facts |
| `packages/server/src/facts.ts` | Express router for LLM API integration |
| `packages/server/src/llm.ts` | LLM provider abstraction (Anthropic/OpenAI) |
| `packages/server/src/config.ts` | Server-side config management (persisted to disk) |

---

## Implementation Steps

### Phase 1: Shared Types & Configuration

1. **Update shared types** (`packages/shared/src/index.ts`)
   - Add `'facts'` to the `LAYOUTS` array
   - Add `FactsRequest` and `FactsResponse` interfaces
   - Add `FactsConfig` interface for LLM configuration
   - Add `LLM_PROVIDERS` constant array

2. **Update environment configuration**
   - Add `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` to `.env.example`
   - Add `LLM_PROVIDER` setting (default: `anthropic`)

3. **Create server config management** (`packages/server/src/config.ts`)
   - Persisted JSON config file (`./config/facts-config.json`)
   - Default prompt template
   - API for reading/updating config

### Phase 2: Server-Side LLM Integration

3. **Create LLM provider abstraction** (`packages/server/src/llm.ts`)
   - Abstract interface for generating facts
   - Anthropic Claude implementation
   - OpenAI GPT-4 implementation
   - Provider selection based on config/available keys

4. **Create facts API endpoint** (`packages/server/src/facts.ts`)
   - `POST /api/facts` endpoint
   - Request body: `{ title, artist, album }`
   - In-memory cache (Map) keyed by `artist:album:title`
   - Cache TTL: 24 hours (facts don't change)
   - Error handling for API failures (graceful degradation)

5. **Register facts router** (`packages/server/src/index.ts`)
   - Import and mount facts router at `/api`

### Phase 3: Client-Side Implementation

6. **Create useFacts composable** (`packages/client/src/composables/useFacts.ts`)
   - Reactive facts state
   - Loading/error states
   - Fetch facts when track changes
   - Client-side caching (sessionStorage)
   - Debounce to avoid rapid API calls during track skipping

7. **Create FactsLayout component** (`packages/client/src/layouts/FactsLayout.vue`)
   - Two-column layout (similar to AmbientLayout)
   - Left: Album artwork (55%)
   - Right: Facts panel with auto-rotating slideshow (45%)
   - **Slideshow features:**
     - Auto-advances based on fact length (8-30s per fact)
     - Fade transitions between facts (500ms)
     - Dot indicators showing current fact position
     - Pauses when track is paused, resumes when playing
   - Loading skeleton while fetching
   - Graceful error state (show track info without facts)
   - Dynamic color extraction (reuse `useColorExtraction`)
   - Responsive design (stacked on mobile)

8. **Register layout in NowPlaying** (`packages/client/src/components/NowPlaying.vue`)
   - Import `FactsLayout`
   - Add case to `layoutComponent` computed

### Phase 4: Admin Panel Configuration

9. **Add Facts Configuration section to Admin Panel** (`packages/client/src/views/AdminView.vue`)
   - New collapsible section: "Facts Layout Configuration"
   - LLM provider selector dropdown
   - API key input fields (masked)
   - Custom prompt editor (textarea)
   - "Test Configuration" button
   - "Save" / "Reset to Defaults" buttons

10. **Create config API endpoints** (`packages/server/src/index.ts`)
    - `GET /api/config/facts` - Get current facts config
    - `POST /api/config/facts` - Update facts config
    - `POST /api/config/facts/test` - Test LLM connection with current config

---

## Technical Specifications

### Facts Configuration Types

```typescript
// LLM Provider options
export const LLM_PROVIDERS = ['anthropic', 'openai'] as const;
export type LLMProvider = (typeof LLM_PROVIDERS)[number];

// Model options per provider
export const LLM_MODELS = {
  anthropic: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250514'] as const,
  openai: ['gpt-4o', 'gpt-4o-mini'] as const,
} as const;

// Facts configuration (stored on server)
export interface FactsConfig {
  enabled: boolean;
  provider: LLMProvider;
  model: string;
  apiKey: string;           // Stored encrypted or in env var
  prompt: string;           // Customizable prompt template
  factsCount: number;       // Number of facts to generate (default: 5)
  rotationInterval: number; // Fallback rotation time in seconds (default: 25)
}

// Default prompt template
export const DEFAULT_FACTS_PROMPT = `Generate {factsCount} interesting, lesser-known facts about this music:

Artist: {artist}
Album: {album}
Track: {title}

Search pattern context: {artist} "{title}" {album} interesting fact story behind

Focus on:
- Recording history or interesting production details
- Historical context or cultural impact
- Connections to other artists or musical movements
- Awards, chart positions, or notable achievements
- Personal stories from the artist about this work

Keep each fact concise (2-3 sentences max). Prioritize surprising or educational information over common knowledge.
Return ONLY a JSON array of strings, no other text.`;
```

### Admin Panel UI Design

```
┌─────────────────────────────────────────────────────────────┐
│ ▼ Facts Layout Configuration                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Enable Facts Layout  [✓]                                   │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  LLM Provider                                               │
│  ┌─────────────────────────────────┐                       │
│  │ Anthropic (Claude)           ▼ │                       │
│  └─────────────────────────────────┘                       │
│                                                             │
│  Model                                                      │
│  ┌─────────────────────────────────┐                       │
│  │ claude-sonnet-4-20250514     ▼ │                       │
│  └─────────────────────────────────┘                       │
│                                                             │
│  API Key                                                    │
│  ┌─────────────────────────────────┐                       │
│  │ sk-ant-••••••••••••••••••••     │  [Show/Hide]         │
│  └─────────────────────────────────┘                       │
│  💡 Set via ANTHROPIC_API_KEY env var for security         │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  Facts Count: [5] (1-10)                                    │
│                                                             │
│  Rotation Interval: [25] seconds (fallback)                 │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  Prompt Template                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Generate {factsCount} interesting, lesser-known     │   │
│  │ facts about this music:                             │   │
│  │                                                     │   │
│  │ Artist: {artist}                                    │   │
│  │ Album: {album}                                      │   │
│  │ Track: {title}                                      │   │
│  │ ...                                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│  Available variables: {artist}, {album}, {title},          │
│                       {factsCount}                          │
│                                                             │
│  ┌──────────────┐  ┌─────────────────┐  ┌───────────────┐  │
│  │ Test Config  │  │ Reset Defaults  │  │     Save      │  │
│  └──────────────┘  └─────────────────┘  └───────────────┘  │
│                                                             │
│  ✓ Configuration saved successfully                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Facts API Request/Response

```typescript
// Request
interface FactsRequest {
  title: string;
  artist: string;
  album: string;
}

// Response
interface FactsResponse {
  facts: string[];      // Array of 5-6 interesting facts
  cached: boolean;      // Whether this was served from cache
}
```

### LLM Prompt Strategy

The default prompt includes search pattern hints to guide the LLM toward the types of information typically found in reliable sources:

```
Generate {factsCount} interesting, lesser-known facts about this music:

Artist: {artist}
Album: {album}
Track: {title}

When researching, consider information typically found via searches like:
- {artist} "{title}" story behind OR meaning behind OR making of
- {artist} {album} interview OR "behind the scenes"
- Sources like Wikipedia song pages, Songfacts, music publications

Focus on:
- Recording history or interesting production details
- Historical context or cultural impact
- Connections to other artists or musical movements
- Awards, chart positions, or notable achievements
- Personal stories from the artist about this work

Keep each fact concise (2-3 sentences max). Prioritize surprising or educational information over common knowledge.
Return ONLY a JSON array of strings, no other text.
```

**Prompt Variables:**
| Variable | Description |
|----------|-------------|
| `{artist}` | Artist/band name from track metadata |
| `{album}` | Album name from track metadata |
| `{title}` | Song title from track metadata |
| `{factsCount}` | Configured number of facts (default: 5) |

### Auto-Rotating Facts Display

The facts will cycle automatically during playback like a slideshow:

**Timing Algorithm:**
1. Calculate reading time based on fact length: `baseTime = wordCount * 250ms` (average reading speed)
2. Add padding for visual absorption: `displayTime = baseTime + 3000ms`
3. Clamp to reasonable bounds: `min: 8s, max: 30s`
4. Fallback for errors: `25 seconds` fixed interval

**Visual Transitions:**
- Smooth fade-out/fade-in between facts (500ms transition)
- Subtle dot indicators showing current position (like carousel dots)
- Progress indicator showing time until next fact (optional, subtle)

**Behavior:**
- Auto-advances when playing
- Pauses rotation when track is paused
- Resets to first fact when track changes
- User can click/tap to manually advance (optional enhancement)

### Cache Strategy

**Server-side:**
- In-memory Map with TTL (24 hours)
- Key format: `${artist}::${album}::${title}` (normalized to lowercase)
- Consider file-based cache for persistence across restarts

**Client-side:**
- SessionStorage for current session
- Prevents re-fetching same track within session

---

## Edge Cases

| Case | Handling |
|------|----------|
| No API key configured | Server returns 503, layout shows track info without facts, admin shows warning |
| LLM API rate limit | Return cached response if available, otherwise graceful degradation |
| LLM API timeout | 10-second timeout, show error state with retry option |
| Unknown artist/track | LLM will still attempt, facts may be sparse |
| Very long facts response | Truncate/scroll within facts panel |
| Rapid track changes | Debounce 500ms before fetching facts |
| No track playing | Show "No playback" state (same as other layouts) |
| Network error | Show cached facts if available, otherwise error message |
| Invalid API key | "Test Config" shows error, prevents save with invalid key |
| Empty/malformed prompt | Validation prevents save, shows error message |
| Config file missing | Create with defaults on first access |
| Config file corrupted | Reset to defaults, log warning |
| Facts layout selected but disabled | Fall back to "detailed" layout with toast notification |

---

## Test Strategy

### Unit Tests
- `useFacts.spec.ts` - Test composable behavior, caching, error states
- `llm.spec.ts` - Test provider abstraction with mocked APIs

### Integration Tests
- Facts API endpoint with mocked LLM responses
- Layout rendering with various states (loading, success, error)

### Manual Testing
- Test with real Anthropic/OpenAI keys
- Verify facts quality and relevance
- Test cache behavior across track changes
- Verify responsive layout on different screen sizes

---

## Potential Risks

| Risk | Mitigation |
|------|------------|
| API costs accumulating | Aggressive caching, rate limiting |
| LLM hallucinating facts | Include disclaimer "Facts may not be 100% accurate" |
| Slow API responses (>2s) | Show engaging loading state, consider pre-fetching |
| API key exposure | Server-side only, environment variables |
| Breaking existing layouts | Facts layout is additive, no changes to existing layout logic |

---

## Future Enhancements (Out of Scope)

- Pre-fetch facts for next track in queue
- User rating/feedback on facts quality
- Facts personalization based on user interests
- Wikipedia/MusicBrainz fallback for basic info
- Streaming facts display (show facts as they generate)

---

## Dependencies

### New NPM Packages (Server)
- `@anthropic-ai/sdk` - Anthropic Claude API client
- `openai` - OpenAI API client (optional, for OpenAI support)

---

**Approve this plan?** (yes / no / modify)
