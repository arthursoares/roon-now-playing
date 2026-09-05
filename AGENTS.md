# Repository guidance

<!-- AUTONOMY DIRECTIVE — DO NOT REMOVE -->
YOU ARE AN AUTONOMOUS CODING AGENT. EXECUTE TASKS TO COMPLETION WITHOUT ASKING FOR PERMISSION.
DO NOT STOP TO ASK "SHOULD I PROCEED?" — PROCEED. DO NOT WAIT FOR CONFIRMATION ON OBVIOUS NEXT STEPS.
IF BLOCKED, TRY AN ALTERNATIVE APPROACH. ONLY ASK WHEN TRULY AMBIGUOUS OR DESTRUCTIVE.
USE CODEX NATIVE SUBAGENTS FOR INDEPENDENT PARALLEL SUBTASKS WHEN THAT IMPROVES THROUGHPUT.
<!-- END AUTONOMY DIRECTIVE -->

## Architecture

- `packages/client`: Vue 3 display layouts and administration UI, built with Vite.
- `packages/server`: Express HTTP API, WebSocket sessions, Roon integration, and external sources.
- `packages/shared`: protocol types, settings, and display constants. Consumers resolve its build output.
- `site`: independent Astro website, built with npm and its own lockfile.
- `e2e`: Playwright layout checks and visual review tooling.

The main workspace uses the pnpm version pinned in `package.json`. Keep its
`pnpm-lock.yaml`; do not generate a root npm lockfile. Roon packages are GitHub
dependencies. Do not add dependencies without an explicit request.

## Behavior to preserve

- Displays work without Roon when `ROON_ENABLED=false`.
- Each route owns its WebSocket session. Device identity persists across sessions.
- Server settings persist in `DATA_DIR`; additions must work through storage,
  WebSocket replay, and admin updates, including older stored settings.
- URL layout/font/background overrides remain supported.
- Ignore async artwork/facts results for a track that is no longer current.
- Keep `basic` layout compatible with older browsers. Avoid introducing CSS
  `gap`, `aspect-ratio`, or `backdrop-filter` into that layout.
- Reuse shared display constants and the client background classification helper.
- Source API-key protection covers source writes and key/protection changes;
  it is not application-wide authentication. Do not expose credentials in logs.

## Changes and verification

Write a cleanup plan before refactoring. Add meaningful regression coverage
before behavior changes, prefer deletion to new abstractions, and keep diffs
small. Preserve unrelated work and historical design documents.

Use native subagents for independent work when useful; announce their roles and
assign separate file ownership. Use an independent review for meaningful changes.

Run focused tests during implementation. Before delivery, run applicable checks:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`pnpm typecheck` builds shared types first. Vitest uses Node for server/shared
tests and jsdom for client tests. Mount components when testing Vue lifecycle
hooks; do not suppress lifecycle warnings to make a test appear healthy.

For display changes, run the relevant Playwright constraints and capture affected
layouts with `MATRIX_LAYOUTS`. Review at iPad landscape (1194×834), TV 1080p,
and TV 4K; also check portrait when changing responsive behavior. See README's
visual review instructions. Use isolated test data, not a live Roon library.

Report changed files, simplifications, checks performed, and remaining risks.
Do not merge or deploy unless requested.

## Commits and pull requests

Use Commitizen-style Conventional Commits: `fix(scope): reason`,
`refactor(scope): reason`, `test(scope): reason`, or `chore(scope): reason`.
Keep the subject focused on intent. Explain consequential constraints in the body.
Use git-native Lore trailers when useful, such as `Tested:`, `Not-tested:`,
`Rejected:`, `Confidence:`, and `Directive:`.

For a PR stack, each PR targets the preceding branch; the first targets `main`.
Describe the problem, resulting behavior, validation, and stack order in each PR.
