# Visual Consistency Review — Prompt

Use this prompt to have a vision-capable model audit the **approval matrix contact
sheets** (built by `pnpm run review:pack`, found under
`e2e/screenshots/matrix/_review/<resolution>/<layout>.png`).

Each contact sheet shows **one layout rendered across all 14 background types** at
one resolution. Tiles are labelled with the background name. Hand the model the
sheets for a resolution (start with `TV-1080p`) plus this prompt.

---

You are a senior product designer reviewing a "now playing" display for a hi-fi
audio system, shown on TVs and tablets and viewed from across a room. Below are
contact sheets: each image is ONE layout rendered against ALL background types,
with each tile labelled by its background. Audit them and report only real
problems — be specific, skeptical, and concise.

Check for:

1. **Legibility from a distance** — is the metadata (title/artist/album) and any
   fact text large and high-contrast enough to read from a couch? Flag anything
   that would be unreadable on a TV.
2. **Contrast across backgrounds** — the same layout must stay legible on every
   background. Light backgrounds (`white`, `posterized`, `duotone`, some
   `gradient-*`) are the usual failure: white text vanishing, low-contrast metadata,
   progress bars disappearing. Flag each layout×background tile where text or
   controls lose contrast.
3. **Cross-background consistency within a layout** — do margins/safe-zones, text
   position, and component sizing stay stable across the 14 tiles, or do some
   backgrounds shift/clip/reflow the content?
4. **Cross-layout consistency** — compare the same components across layouts:
   progress bar style/height, time formatting, metadata type scale and weight,
   the now-playing chip. Flag inconsistencies (e.g. progress bar is a hairline in
   one layout and chunky in another).
5. **Broken / empty / clipped renders** — missing artwork, empty fact areas,
   text overflow, content escaping the safe zone, gradient banding.
6. **Distance-appropriateness** — small floating cards, tiny indicators, or large
   empty voids that waste the screen.

Output a single Markdown table, highest severity first:

| Layout | Background(s) | Resolution | Issue | Severity (high/med/low) | Suggested fix |
|--------|---------------|-----------|-------|-------------------------|---------------|

After the table, add a short "Systemic" section: patterns that recur across many
cells (e.g. "all layouts: white text fails on the `white` background") — these are
the highest-leverage fixes. Do not invent issues; if a tile looks correct, say
nothing about it.
