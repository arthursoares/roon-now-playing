# Changelog

All notable changes to this project will be documented in this file.

## [1.7.1] - 2026-02-10

### Fixed

- **Roon pairing now persists across Docker container restarts**. Previously, `node-roon-api` wrote its auth tokens to `config.json` in the working directory (`/app/config.json`), which fell outside the mounted `/app/config/` volume. Added custom `set_persisted_state`/`get_persisted_state` callbacks to redirect Roon state into `./config/roonstate.json`, inside the Docker volume.

- **Client friendly names now persist in Docker**. Changed `clientNames.ts` default `DATA_DIR` from `'.'` to `'./config'` so `client-names.json` lands inside the mounted volume alongside other config files.

- **Roon extension display version** updated from `1.5.1` to `1.7.1` (was stale).

## [1.7.0] - 2026-02-09

### Added

- **Self-Service Welcome Screen**: New displays show a clean welcome screen with their auto-generated friendly name and a QR code linking to their config page. Replaces the Roon-specific "Waiting for Roon Core..." message.

- **Auto-Generated Friendly Names**: Screens automatically receive a memorable name on first connect (e.g., `gentle-fox-17`, `calm-falcon-3`). Names are persisted across reconnects. Admins can rename anytime.

- **Per-Screen Config Page** (`/admin/screen/:name`): A focused, mobile-friendly page for configuring a single display. Scan the QR code from your phone to land directly on the right screen's settings — zone, layout, font, and background.

- **Roon Optional Mode** (contributed by @leolobato): Set `ROON_ENABLED=false` to run without Roon entirely. The app runs in external-sources-only mode — no Roon discovery, no "Waiting for Roon" screen. Includes:
  - `RoonClient` is nullable throughout the server
  - `roon_enabled` flag sent to clients via WebSocket
  - Admin panel shows "Connected (External only)" status
  - Docker Compose files updated with commented `ROON_ENABLED` option

- **Screen Lookup API**: New `GET /api/admin/screens/:friendlyName` endpoint to resolve a screen by its friendly name.

- **Name Validation**: Friendly name uniqueness check and 50-character length limit on rename.

### Changed

- Welcome screen now works for all users (Roon, API-only, or no sources yet)
- Admin panel connection label is Roon-aware ("Connected", "Waiting for Roon", or "Connected (External only)")
- Updated README with new onboarding flow, Roon-optional docs, and updated project structure

## [1.6.0] - 2026-02-02

### Added

- **Configurable Typography**: All layouts now have CSS custom properties for font sizes and line heights at the top of their style sections. This makes it easy to adjust typography without hunting through CSS rules.
  - Variables include: `--font-title`, `--font-artist`, `--font-fact`, `--line-height-title`, etc.
  - Each layout has a clearly marked "TYPOGRAPHY CONFIGURATION" block

- **E2E Visual Testing**: Added Playwright-based end-to-end testing for layout validation
  - Screenshot capture tests for all 9 layouts across multiple viewports
  - Layout constraint tests to verify facts column alignment
  - Smoke tests to catch rendering errors
  - Configured viewports: TV 1080p, TV 4K, iPad, Android tablet, various monitors

### Changed

- **Improved Font Scaling**: Increased `clamp()` max values for better readability on 4K displays
- **Tighter Line Heights**: Reduced line spacing for more compact text on smaller viewports (1080p, iPad)
- **Facts Column Alignment**: Fixed vertical alignment issues where facts column extended below artwork

### Layouts Updated

- FactsColumnsLayout
- AmbientLayout
- MinimalLayout
- DetailedLayout
- FactsOverlayLayout
- FactsCarouselLayout

## [1.5.1] - Previous Release

See git history for earlier changes.
