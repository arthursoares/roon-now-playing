# ChatGPT sign-in for facts: design boundary

Issue #33 includes sign-in research as well as API model support. The API-key facts path remains the implementation for this branch. ChatGPT subscription login is technically supported through Codex App Server, but is a separate provider/runtime integration, not a token substituted into `new OpenAI({ apiKey })`.

## Supported candidate

[Codex App Server](https://learn.chatgpt.com/docs/app-server#auth-endpoints) exposes managed browser and device-code login, token persistence/refresh, account status, logout, quota reporting, and model discovery. [Codex's model catalog](https://learn.chatgpt.com/docs/models) lists GPT-5.6 Luna; actual account entitlement must be checked after login.

For a Docker/NAS deployment, prefer managed device-code login, subject to its account/workspace setting. Browser callbacks run on the host running Codex, which may be different from the phone or laptop used to administer the display. The [authentication guide](https://learn.chatgpt.com/docs/auth) documents these flows and their credential-storage behavior.

## Requirements before implementation

1. Add an optional, supervised Codex backend using stdio and a pinned runtime verified on both container architectures and the chosen base image. This is an additional deployment dependency.
2. Give it a private persistent credential directory. Keep tokens out of display WebSockets, public configuration responses, logs, and browser storage. Let Codex own refresh; do not import unrelated user authentication caches.
3. Add an explicit administrator authorization boundary for login, account status, cancellation, and logout. Current facts configuration routes are not application-wide authentication. Source API keys protect source operations and should not be repurposed as this boundary.
4. Expose only the small set of account/generation operations the app needs, not raw Codex RPC. Isolate generation from the filesystem and executable tools; verify enforceable tool disabling before accepting untrusted track metadata or prompts.
5. Start isolated generation contexts, require the facts output contract, and verify enforceable output/time limits. Preserve request sharing, configuration/account isolation, refusal/truncation handling, and cache behavior.
6. Test login cancellation/expiry, refresh, restarts, unavailable models, exhausted quotas, and logout. Show whether requests consume subscription entitlements or metered API billing. Never fall back silently to a billed API key.

The open implementation decision is whether the benefit of subscription sign-in justifies this extra service and account-management surface for a small facts workload. API-key Luna remains usable independently. Account availability, exact container/runtime compatibility, and enforceable tool/output restrictions still require a dedicated integration spike before production sign-in can be promised.

## Current documented Codex model catalog

As checked on 2026-09-06: `gpt-5.6-luna`, `gpt-5.6-terra`, `gpt-5.6-sol`, `gpt-6-astra` (rollout/access restrictions), and `gpt-5.5` (other-model category). `gpt-5.3-codex-spark` is a Pro-only text research preview and should not be copied into the ordinary API picker. Account-specific availability should ultimately come from `model/list` after sign-in.

The [documented GPT-5.4 retirement](https://learn.chatgpt.com/docs/enterprise/workspace-model-availability#prepare-for-the-gpt-54-retirement) took effect for Codex ChatGPT sign-in on August 31, 2026; it explicitly does not retire those models from API-key access. The app's broader old-picker migration to Luna follows the requested inexpensive-facts policy.
