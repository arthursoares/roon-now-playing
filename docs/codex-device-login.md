# Connect ChatGPT with a device code

This optional integration connects a ChatGPT account to the server. It supports sign-in, cancellation, account status, and logout. **Subscription-powered facts generation is not enabled yet.** Existing facts generation continues to use the independently configured API provider.

The server displays a verification link and one-time code. Open the link on your phone or computer, sign in to OpenAI, and enter the displayed code there. The server receives the completed login automatically; do not paste OAuth tokens into the facts API-key field.

## Docker setup

The regular image stays unchanged. Build the optional `codex` target, which includes the pinned official `@openai/codex@0.153.4` runtime. Its npm package selects the Linux musl binary for amd64 or arm64. This adds a substantial runtime dependency only to the optional image.

From this repository checkout, create a dedicated account-administrator token and start with the override:

```sh
export CODEX_ADMIN_TOKEN="$(openssl rand -hex 32)"
docker compose -f docker-compose.yml -f docker-compose.codex.yml up -d --build
```

Keep that token in your deployment's secret configuration for subsequent restarts. Enter the same token in the account panel to unlock its controls. It is separate from source API keys and OpenAI API keys; it protects only the Codex account endpoints, not the whole Admin page. Use HTTPS when administering over an untrusted network.

If using a reverse proxy, preserve the browser's original `Host` header (including a non-default port). Account endpoints check browser origins against it. The development proxy preserves this header for account routes.

The override persists credentials in the dedicated `codex-account` volume. Keep this volume private and writable so Codex can refresh its managed credentials. Logging out clears the managed login; removing the volume loses the saved connection. Do not copy your desktop Codex credential directory into it.

## Local or existing deployments

Install the pinned Codex runtime on the server, then configure these environment variables before starting the app:

| Variable | Meaning |
| --- | --- |
| `CODEX_ENABLED=true` | Opt in to account connection. Defaults to disabled. |
| `CODEX_ADMIN_TOKEN` | Dedicated random bearer token; 32–256 non-space ASCII characters. Missing or invalid values disable the integration. |
| `CODEX_BINARY` | Optional trusted executable path; defaults to `codex` on the server's PATH. |
| `CODEX_ACCOUNT_DIR` | Optional private persistent directory; defaults to `DATA_DIR/codex-account` (`./config/codex-account` without DATA_DIR). |

Only trusted deployment configuration selects the executable or credential path. The child process receives an isolated home and a restricted environment; it does not inherit the application's OpenAI API key or your desktop authentication.

Default local credential directories are excluded from git and Docker build contexts. If you override `CODEX_ACCOUNT_DIR`, choose a private location outside the checkout and Docker build context.

## Sign in

1. Open `/admin`, select **AI Facts**, and find **ChatGPT account**.
2. Enter the dedicated administrator token and choose **Unlock account controls**.
3. Choose **Connect ChatGPT**. Open the displayed OpenAI verification link on another device and enter the code.
4. Complete sign-in on OpenAI's page. The account panel updates to show the connected account.

If device-code login is unavailable, enable it in your ChatGPT security settings or ask your workspace administrator to enable it. OpenAI documents this requirement in its [headless authentication guide](https://learn.chatgpt.com/docs/auth#login-on-headless-devices).

An attempt has a local ten-minute deadline; OpenAI may expire its code earlier. Cancel and request a new code if needed. Leaving the page or locking the controls forgets the browser's administrator token but does not cancel the server's pending login or sign out the account. Unlock again to resume viewing the current state. **Sign out** ends the saved account connection.

## Account API and validation

`GET /api/codex/capabilities` exposes only enablement flags. Account status and login/cancel/logout endpoints require the dedicated bearer token, return uncacheable responses, and reject foreign browser origins. The browser keeps its token only in component memory. Tokens are never sent to display WebSockets or persisted in browser storage.

The backend exposes a fixed set of account operations through stdio App Server. It exposes no raw RPC endpoint and never starts a generation thread or turn. Protocol errors and child stderr are not returned to browsers. Device verification links must match the documented OpenAI HTTPS endpoint.

Automated fixtures verify the login lifecycle, authorization, stale responses, and UI states. The optional runtime CI checks the pinned binary in both architecture builds. Real account approval, token refresh over time, quota/model entitlement, and restart persistence with a real account still require a live integration check; mocked success does not prove them.

A local smoke check with the actual Codex 0.153.4 binary verified initialization, signed-out account status from an empty isolated home, and terminal process shutdown. It requested no login or generation and accessed no existing credentials.

A second isolated check successfully issued and cancelled a real OpenAI device code without approving an account or requesting generation. The runtime created private SQLite state/log files; a literal scan of the files present during that attempt found no copy of the device code. The temporary profile was removed afterward. This is evidence for that specific attempt, not a guarantee about every runtime log path or authenticated-account event; keep the entire persistent volume private.

The generation limits and isolation investigation remain documented in [the sign-in design and protocol findings](facts-openai-signin.md). Connecting an account does not bypass those outstanding requirements or silently switch facts billing.
