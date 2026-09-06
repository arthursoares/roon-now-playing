# Connect ChatGPT with a device code

This optional integration connects a ChatGPT account to the server and provides the **ChatGPT (Codex)** facts provider. It researches web sources, saves attributed artist/album facts, and reuses them across tracks. API-key providers remain independently selectable, with no automatic billing fallback.

The server displays a verification link and one-time code. Open the link on your phone or computer, sign in to OpenAI, and enter the displayed code there. The server receives the completed login automatically; do not paste OAuth tokens into the facts API-key field.

## Docker setup

The regular image stays unchanged. Build the optional `codex` target, which includes the pinned official `@openai/codex@0.153.4` runtime. Its npm package selects the Linux musl binary for amd64 or arm64. This adds a substantial runtime dependency only to the optional image.

From this repository checkout, start with the override:

```sh
docker compose -f docker-compose.yml -f docker-compose.codex.yml up -d --build
```

Account controls, provider settings, and research tests use the app's existing Admin access model, just like API-key settings. There is no separate Codex administrator token or unlock step.

If using a reverse proxy, preserve the browser's original `Host` header (including a non-default port). Account endpoints check browser origins against it. The development proxy preserves this header for account routes.

The override persists credentials in the dedicated `codex-account` volume. Keep this volume private and writable so Codex can refresh its managed credentials. Logging out clears the managed login; removing the volume loses the saved connection. Do not copy your desktop Codex credential directory into it.

## Local or existing deployments

Install the pinned Codex runtime on the server, then configure these environment variables before starting the app:

| Variable | Meaning |
| --- | --- |
| `CODEX_ENABLED=true` | Make account connection and the Codex provider available. Defaults to disabled. |
| `CODEX_BINARY` | Optional trusted executable path; defaults to `codex` on the server's PATH. |
| `CODEX_ACCOUNT_DIR` | Optional private persistent directory; defaults to `DATA_DIR/codex-account` (`./config/codex-account` without DATA_DIR). |

Only trusted deployment configuration selects the executable or credential path. The child process receives an isolated home and a restricted environment; it does not inherit the application's OpenAI API key or your desktop authentication.

Default local credential directories are excluded from git and Docker build contexts. If you override `CODEX_ACCOUNT_DIR`, choose a private location outside the checkout and Docker build context.

## Sign in

1. Open `/admin`, select **AI Facts**, and find **ChatGPT account**.
2. Choose **Connect ChatGPT**. Open the displayed OpenAI verification link on another device and enter the code.
3. Complete sign-in on OpenAI's page. The account panel updates to show the connected account.
4. Select **ChatGPT (Codex)** as the AI provider, choose a model (Luna is the default), and save.
5. Open **Test** to research a sample track. A test forces fresh research and reports source links, search/page-open counts, and latency. Normal display requests reuse cached work.

If device-code login is unavailable, enable it in your ChatGPT security settings or ask your workspace administrator to enable it. OpenAI documents this requirement in its [headless authentication guide](https://learn.chatgpt.com/docs/auth#login-on-headless-devices).

An attempt has a local ten-minute deadline; OpenAI may expire its code earlier. Cancel and request a new code if needed. Leaving the Admin page does not cancel the server's pending login or sign out the account. Return to AI Facts to see its current state. **Sign out** ends the saved connection and cancels its active research.

## Research and reuse

The provider uses low reasoning, validates the exact selected model against the connected account's catalog, and performs one research job at a time with a bounded queue. It applies a three-minute whole-operation deadline and local response-size limits. There is no hard model output-token cap. Saved API-provider caps and credentials remain independent.

Historical research is cached for 30 days, with up to 500 records. Selected track results are cached for 72 hours, with up to 1,000 records; combined serialized entries are capped at 16 MiB. Different tracks on an album share the same research job and reuse artist/album facts. Track-specific facts are used only for their matching title. Forced research refreshes the album pool, and sibling track selections are refreshed from that pool without another model call. Cache contents survive ordinary server restarts.

Facts retain source links through the cache and all three facts layouts. Links must match observed public-HTTPS page-open events. This is source attribution, not independent proof that every claim is supported. Ambiguous album editions and compilation artists remain a limitation of the current artist/album/title metadata.

## Account API and validation

`GET /api/codex/capabilities` exposes only enablement flags. Account status and login/cancel/logout endpoints return uncacheable responses and reject foreign browser origins. OAuth credentials stay in the server's private storage; they are never sent to display WebSockets or persisted in browser storage.

The backend exposes narrow account and research operations through stdio App Server, with no raw RPC or process-control HTTP endpoint. Research uses ephemeral isolated threads, private homes, empty runtime workspaces, disabled agents/skills, and the restricted hosted-web tool configuration. Protocol errors and child stderr are not returned to browsers. Device verification links must match the documented OpenAI HTTPS endpoint.

Automated fixtures verify the login/research lifecycle, authorization, stale responses, cache reuse, and UI states. The optional runtime CI runs a complete offline research check with the real Codex binary on both architectures. Real account approval, token refresh over time, quota/model entitlement, public source retrieval, and restart persistence with a real account still require a live integration check; mocked success does not prove them.

A local smoke check with the actual Codex 0.153.4 binary verified initialization, signed-out account status from an empty isolated home, and terminal process shutdown. It requested no login or generation and accessed no existing credentials.

A second isolated check successfully issued and cancelled a real OpenAI device code without approving an account or requesting generation. The runtime created private SQLite state/log files; a literal scan of the files present during that attempt found no copy of the device code. The temporary profile was removed afterward. This is evidence for that specific attempt, not a guarantee about every runtime log path or authenticated-account event; keep the entire persistent volume private.

The [research design](plans/2026-09-06-codex-web-facts.md) and [protocol findings](facts-openai-signin.md) record the implementation decisions. Connecting an account does not select the provider automatically; explicitly save the provider choice to change how facts are generated.
