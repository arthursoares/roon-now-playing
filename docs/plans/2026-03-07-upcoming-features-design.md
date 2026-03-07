# Upcoming Features Design

## Feature 1: Idle Screen / Screensaver Mode

### Problem
When nothing is playing, displays show a static "No playback" message. For always-on displays (tablets, wall-mounted screens), this is a missed opportunity.

### Design

**Idle screen mode** activates after a configurable delay (default: 60 seconds) following playback stop/pause. This avoids flicker on brief pauses. Transition uses a crossfade.

**Two idle modes (per-screen configurable):**

1. **Ambient Clock (default)** — Shows time + date with an ambient color animation. Uses the last played track's extracted colors for the palette, falling back to a neutral dark theme if no track has played.

2. **External URL embed** — Renders an iframe pointing to a user-configured URL (e.g., Immich Kiosk for photo slideshows, a weather dashboard, Home Assistant, etc.). The URL is configured per-screen via the admin panel or URL parameter.

**Per-screen settings (new fields on screen config):**
- `idleMode`: `'clock'` | `'url'` (default: `'clock'`)
- `idleUrl`: `string | null` (default: `null`)
- `idleDelaySeconds`: `number` (default: `60`)

**Transition behavior:**
- Playback stops/pauses -> timer starts
- If playback resumes before timer expires -> cancel, stay on now-playing
- Timer expires -> crossfade to idle screen
- Playback resumes -> crossfade back to now-playing immediately

### Considerations
- iframe sandboxing: use `sandbox="allow-scripts allow-same-origin"` for security
- Some URLs may not allow embedding (X-Frame-Options) — show a graceful fallback message
- Clock should respect system locale for date/time formatting
- Ambient clock animation should be subtle/low-power (CSS-only, no heavy JS animation) to be kind to always-on displays

---

## Feature 2: Layout Preview in Admin

### Problem
Users must switch layouts by trial and error — there's no way to see what a layout looks like with the current track without applying it to a screen.

### Design

**Static preview cards** in the admin panel that approximate each layout's appearance using the current track's artwork and colors. Not pixel-perfect live renders, but representative enough to make an informed choice.

**Approach:** Pre-designed preview card components that:
- Use the currently playing track's artwork (thumbnail-sized)
- Apply the screen's current background type and extracted colors
- Show a simplified representation of each layout's structure (artwork placement, text position, progress bar location)
- Are rendered as small cards (~200x130px, roughly 16:10) in a grid

**Where it appears:**
- Admin panel, in the per-screen configuration section
- Replaces or augments the current layout dropdown with a visual grid picker

**Why not live iframes:** Rendering 9 simultaneous live layouts is heavy and complex. Static preview cards are lightweight, fast, and good enough for choosing a layout.

### Considerations
- Preview cards need to update when the track changes (reactive to WebSocket data)
- Cards should show the layout name below the preview
- Currently selected layout should be visually highlighted
- Could reuse color extraction from the admin's view of the current track artwork
