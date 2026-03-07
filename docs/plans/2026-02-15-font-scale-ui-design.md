# Font Scale UI Design

**Date:** 2026-02-15
**Status:** Approved

## Summary

Add UI controls to adjust font scale globally and per-screen, with live preview via WebSocket.

## Requirements

1. **Global font scale** — slider in Admin panel, applies to all screens by default
2. **Per-screen override** — checkbox to use global or set custom scale per screen
3. **Live preview** — changes push via WebSocket immediately
4. **Fix input layout** — address layout issues in admin panel input boxes

## Implementation

### CSS Variable Approach

Add `--font-scale` variable that multiplies the base token sizes:

```css
:root {
  --font-scale: 1;
}

.fact-text {
  font-size: calc(var(--text-lg) * var(--font-scale, 1));
}
```

### Data Model

**Server config** (`config/display-settings.json`):
```json
{
  "fontScale": 1.0
}
```

**Per-screen** (stored in client preferences via WebSocket):
```json
{
  "fontScaleOverride": null,  // null = use global, number = custom
}
```

### UI Components

**Admin Panel — Display Settings section:**
- Slider: range 0.75 to 1.5, step 0.05
- Label showing current value (e.g., "1.0x")
- Debounced save (300ms)

**Screen Config — Font Scale override:**
- Checkbox: "Use global setting"
- Slider (disabled when checkbox checked)
- Preview updates live

### WebSocket Integration

- New message type: `display_settings_update`
- Server broadcasts to all clients when global changes
- Per-screen settings sent via existing `settings` message

### Input Box Layout Fixes

Review and fix layout issues in:
- `/admin` panel input fields
- `/admin/screen/:name` config inputs
- Ensure proper spacing, alignment, and overflow handling

## Browser Support

CSS `calc()` with custom properties: 97%+ support. No concerns.
