# Codex facts: web research and cache reuse

## Decisions

The requested Codex provider will use web sources and cache the research. A hard model output-token cap is **not required** for this provider. Existing API-provider token caps remain unchanged. Request deadlines, bounded local response handling, request sharing, and account cancellation still apply.

Account controls use the existing Admin access model. The separate Codex administrator-token gate was removed at the user's request; it added a step that API-key settings did not require.

This design for issue #33 is now implemented by the optional Codex provider; see [setup and verification](../codex-device-login.md). The investigation below used code review and offline protocol fixtures, with no authenticated search or model calls. Real-account validation remains separate from those fixtures.

## Current efficiency

The current providers generate from model knowledge: their requests contain no web-search tool. Each track sends one completion request containing artist, album, title, and the configured prompt.

Existing protections are useful and should be retained:

- A short default prompt and inexpensive model/reasoning defaults.
- A 500 ms client debounce, stale-track rejection, and cancellation of obsolete browser requests.
- Server-side sharing of identical in-flight requests across displays.
- A configuration-aware 72-hour cache capped at 1,000 results, with asynchronous atomic persistence.
- No automatic retries or escalation to a more expensive model.

The cache key includes the track title. Twelve distinct tracks from the same album can therefore trigger twelve separate model requests, even though much of the useful artist/album context overlaps. That is not twelve web searches today; there is no research layer yet.

The production path does not report token usage, research calls, or cache-hit rates. Existing opt-in live evaluations measure model usage/latency and response shape, not factual correctness. New search savings must be measured rather than inferred from the number of HTTP requests: one Codex turn may contain several searches and model exchanges.

## Proposed request flow

1. Check the existing track/configuration result cache.
2. On a miss, check a shared artist/album research record. Coalesce concurrent requests for the same research subject, including different tracks on one album.
3. When research is needed, run one ephemeral Codex research turn. Ask for concise, already-written facts with explicit artist, album, or track scope and source URLs. Prefer artist/label sources, interviews, liner-note material, and reputable music reporting; omit uncertain or ambiguous claims.
4. Select cached facts whose scope matches the current track context. Artist/album facts can be reused; a track fact can only be used for its recorded matching title. Do not relabel album facts as claims about a particular song.
5. Perform additional track research only when the requested content cannot be satisfied by the existing record. Prompts explicitly requiring track-specific information may legitimately need more research.
6. Preserve source attribution alongside the selected display facts, and store the resulting track/configuration result. A cache hit should not require an extra LLM call merely to reword or rotate text.

For an album with sufficient reusable research, later tracks should need no further model turn. This is an acceptance target, not a measured speedup.

Keep the first implementation focused. A separate deterministic MusicBrainz lookup can later help entity resolution and metadata retrieval, but adding multiple retrieval providers plus a second formatting LLM call is not necessary to deliver the first useful research cache.

## Cache and identity rules

- Keep research records separate from final display results. Store source URLs, titles when available, research time, and each fact's subject scope.
- Start with a bounded 30-day research lifetime for historical facts, with explicit invalidation. Avoid time-sensitive claims whose meaning silently changes during that interval. The exact lifetime and capacity should be revisited using observed hit rates and storage size.
- Isolate account-owned work and invalidate it on logout/account changes. Configuration fingerprints must cover choices that alter already-written text, including model, instructions/language, and output shape. Do not claim prewritten text can be reused across arbitrary prompt changes.
- Current input only identifies artist, album, and title. Normalize these conservatively and reject ambiguous source matches. Compilation artists, editions, and identically titled releases remain an identity limitation until richer upstream identifiers are available.
- Do not cache failed/empty/unattributed research as successful facts. Use short failure cooldowns if measurements show repeated failed searches across tracks; keep those separate from the success cache.

## Runtime capability evidence

The installed Codex 0.153.4 was probed using a loopback-only provider, an isolated HOME/CODEX_HOME, ephemeral threads, and experimental empty `environments` and `runtimeWorkspaceRoots`.

With the previous execution/app/browser/plugin feature disabling, `web_search = "live"`, and `[agents] enabled = false`, the actual deferred tool inventory was exactly `skills__list`, `skills__read`, and `web__run`. Both skill authorities returned empty lists. The orchestration environment had no `process`, `require`, `fetch`, or `Deno`, and no `exec_command` or `apply_patch` tool. The code-mode host must remain enabled for web orchestration; disabling it made `functions.exec` inert. Disabling only the two multi-agent feature flags had left deferred agent tools available, so the separate agents setting matters.

These checks establish a limited ordinary capability surface, not a general sandbox-security proof. The loopback provider needed its own standalone-search capability flag, which must not be copied blindly into production provider configuration. Actual signed-in search/model availability still needs validation. [Official hosted-search documentation](https://learn.chatgpt.com/docs/web-search) distinguishes hosted web access from local command networking.

## Source attribution contract

An offline conversion test found that normal App Server messages dropped final URL citation annotations and the simulated search action's source list. Explicit `open_page` actions retained their URL as a `webSearch` item. The schema's standalone-search `results` field remains opaque and needs a real response check.

For the first adapter, collect observed HTTPS open-page URLs and accept final source references only when they match that set. Reject unattributed facts. This proves the agent attempted to consult the attributed URL; it does not by itself prove successful retrieval or that the page supports every claim. Do not label these facts independently verified. Preserve richer retrieval/error evidence if authenticated results expose it. [App Server item contract](https://learn.chatgpt.com/docs/app-server)

## Implementation and validation order

1. Add a narrow internal generation interface using the existing supervised runtime and explicit account identity, without exposing raw RPC or process-control methods.
2. Add source-aware research records and in-flight sharing before changing request granularity. Lock same-album/different-track behavior and track-scope exclusions with regressions.
3. Wire the Codex provider and its configuration into the existing Admin/facts routes, retaining API providers and their explicit caps independently.
4. Show source links with generated facts and preserve attribution through caching, layout changes, and errors.
5. Test malformed output, missing/foreign source URLs, incomplete turns, account changes/logout, simultaneous displays, and stale tracks.
6. After account approval, compare first-track latency, subsequent-track latency, research turns, web actions, cache hit rates, model token usage when exposed, and manually checked source support over representative albums.

Do not add a hard output-token-cap gate to this work. The remaining implementation questions concern the generation adapter, source attribution, cache correctness, and real-account behavior.
