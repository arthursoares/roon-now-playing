# Changelog

All notable changes to this project will be documented in this file.

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
