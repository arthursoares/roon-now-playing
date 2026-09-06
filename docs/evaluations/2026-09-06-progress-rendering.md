# Progress rendering evaluation

Issue: [#35](https://github.com/arthursoares/roon-now-playing/issues/35)

## Change and compatibility

Progress previously changed the fill's width every 100 ms, with a matching CSS width transition. The shared ProgressBar and the independent Facts Overlay, Facts Carousel, and Minimal renderers now keep their fill at full width and apply a left-origin `scaleX` transform. A shared helper clamps percentages to the visible range and maps non-finite values to zero. Playback timing, layout dimensions, and color selection remain unchanged.

The implementation plan was to add component regressions, capture a controlled baseline, replace the width animation, then verify the resulting behavior and trace. Independent review found the two Minimal branches omitted from the initial patch; they were included before delivery.

Review also reproduced stale interpolated progress when a new track shared the previous title and numeric seek position. Regression tests first demonstrated the failure. The reset watcher now compares title, artist, album, and duration, preserving interpolation for repeated identical metadata and late artwork updates. Tracks indistinguishable in all those fields still rely on server seek/state updates; the shared track contract supplies no unique playback-instance ID.

## Controlled before/after trace

One headless Chrome run per revision used the Basic layout, a 1194 x 834 viewport at DPR 2, fixed WebSocket playback data (seek 900 seconds, duration 3600 seconds), and no artwork. After a three-second warmup, each recording ran for ten seconds. The page was served by an isolated Vite process and used no live Roon library or facts provider.

| Metric | Before | After |
| --- | ---: | ---: |
| Width-animation compositor failures | 100 | 0 |
| Layout events | 600 | 10 |
| Paint events | 206 | 20 |
| Main-thread RunTask time | 151.764 ms (1.518%) | 105.950 ms (1.060%) |
| Non-startup tasks longer than 50 ms | 0 | 0 |
| Largest non-startup task | 0.461 ms | 0.449 ms |
| Recorded DroppedFrame markers | 0 | 0 |
| Sampled JS heap used, min to max | 4,893,724 to 6,222,744 bytes | 4,898,940 to 6,236,148 bytes |
| Sampled DOM node count, min to max | 143 to 153 | 143 to 152 |

The run had 98.3% fewer Layout events and 90.3% fewer Paint events. These are event counts from a controlled Basic-layout comparison, not a measured CPU or power reduction, and are not a fresh capture from the user's display. No claim is made that all remaining layout or paint work disappeared.

CDP tracing categories were `devtools.timeline,disabled-by-default-devtools.timeline,blink.animations`, with `ReturnAsStream` transfer. Layout/Paint counts include complete (`ph === "X"`) events with the corresponding name. Width compositor failures count `Animation` events with a truthy `args.data.compositeFailed` and `width` in `args.data.unsupportedProperties`. The original local traces were retained as `/private/tmp/progress-before.json` and `/private/tmp/progress-after.json`; raw browser traces are not committed.

Main-thread metrics select the `CrRendererMain` thread's complete RunTask events. Occupancy divides their summed duration by the first-to-last task span (9.999 seconds before, 9.994 seconds after). Non-startup metrics exclude the first 150 ms of each trace. No DroppedFrame markers were recorded, but these tracing categories do not establish a measured zero frame-drop rate. Heap and DOM ranges come from that thread's UpdateCounters samples; this short run cannot establish a leak-free or bounded long-term footprint.

The change adds no application cache or retained collection. Each visible progress fill requests a transform compositing layer via `will-change`; its GPU allocation was not measured. Palette/in-flight cache bounds, parent rerender isolation, animated backgrounds, and long-run memory/power measurements remain deferred follow-up work in #35. This patch addresses its primary progress-rendering cause and does not close the broader investigation.

## Regression checks

- Mounted ProgressBar tests cover live value changes, out-of-range values, NaN, and infinities.
- `e2e/progress-rendering.spec.ts` checks full underlying fill width, left transform origin, and the computed transform transition in Basic, Facts Overlay, Facts Carousel, and Minimal, across iPad landscape/portrait, 1080p, and 4K. Minimal's ordinary and dynamic-background template branches are checked explicitly; those branches are selected by background, not orientation.
- Browser playback checks cover pause, seek while paused, and resume with deterministic WebSocket fixtures.
- Mounted playback regressions cover same-title track changes and repeated metadata/artwork updates.
- The workspace lint, typecheck, unit suite, production build, and diff whitespace checks remain required.

Physical legacy browsers and long-running power consumption were not measured. Transform support is exercised in current Chrome; legacy-device verification remains a deployment check.
