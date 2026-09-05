# Album gallery density cleanup plan

## Existing behavior to protect

- Keep Album Wall layout behavior and its recent-album cards unchanged.
- Keep Album Gallery cover-only: no captions, badges, or overlays.
- Keep each cover square and uncropped (`object-fit: contain`), with clipping limited to viewport edges.
- Keep the 12 distinct recent albums in server order, including one current-album semantic marker.
- Keep missing-artwork placeholders and the empty-history state.

## Cleanup

1. Replace history-count-driven gallery geometry with a fixed minimum visual slot count so short histories cannot produce oversized covers.
2. Use a regular square-tile grid derived from viewport aspect ratio, centered and slightly oversized where necessary to cover every viewport pixel.
3. Cycle the distinct recent albums through the visual slots. Expose metadata only on each album's first occurrence so repetition does not duplicate the accessible gallery.
4. Update focused component, geometry, and Playwright coverage for short histories, density, accessibility, and supported viewport shapes.

No server history changes, new dependencies, animation, clock, or Album Wall redesign are in scope.
