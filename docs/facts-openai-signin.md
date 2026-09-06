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

API-key Luna remains usable independently. The tested configurations in the offline spike below did not satisfy the proposed bounded, tool-free generation contract, and no supported configuration establishing that contract was found. Production sign-in generation remains gated; an experimental mode would require a separate product decision and additional isolation work.

## Offline protocol spike: Codex 0.153.4, 2026-09-06

The investigation generated the installed app-server's stable and experimental JSON schemas and captured outbound requests using a loopback-only Responses provider. Each probe used an empty private Codex home and working directory, no OpenAI credentials, and a local server that rejected the request after recording its shape. No account login or billed model call was performed. These results establish local protocol behavior, not subscription entitlement or upstream model acceptance.

| Requirement | Observed result |
| --- | --- |
| Managed device-code login | Schema supports `account/login/start` with `type: "chatgptDeviceCode"`, plus completion, cancellation, account status, and logout. Real authentication remains untested. |
| Structured facts | `turn/start.outputSchema` becomes a strict JSON-schema `text.format` in the outbound request. |
| Hard output-token cap | `turn/start.maxOutputTokens: 200` was silently ignored, including with `--strict-config`. No `max_output_tokens` reached the outbound request. Neither generated `TurnStartParams` schema exposes this limit. |
| No executable/file tools | Disabling individual execution, app, browser, image, plugin, and multi-agent feature flags did not remove all built-ins. The request still offered execution orchestration and nested `apply_patch`. |
| Experimental empty environments | `environments: []` and `runtimeWorkspaceRoots: []` removed `apply_patch` in the captured request, but retained execution orchestration and skill listing/reading. This is a reduced tool surface, not verified complete isolation. |
| Private prompt context | An isolated `CODEX_HOME` alone still discovered OS-user skill metadata. Setting `skills.include_instructions = false` and `skills.bundled.enabled = false` removed that automatic prompt injection in the probe. |
| Luna reasoning effort | The bundled and unauthenticated `model/list` catalogs advertise `low`, `medium`, `high`, `xhigh`, and `max`. They omit `none`, although the runtime forwards a supplied `none` unchanged. Upstream acceptance is untested. |

Inspect both top-level `tools` and `input` items of type `additional_tools` when reproducing the tool check: this runtime encoded the advertised tools in the latter. A missing top-level `tools` field is insufficient evidence. Read-only sandboxing reported `networkAccess: false`, but this is not proof that arbitrary filesystem reads are impossible; no adversarial tool execution was tested.

The [configuration schema](https://learn.chatgpt.com/docs/config-schema.json) provides individual feature controls and context suppression, but no general tool allowlist or model output-token cap. `tool_output_token_limit` limits tool-result context, not generated model output. A request deadline, request quota, or response-byte limit can bound local work but cannot be presented as an equivalent token cap.

### Integration details to preserve in a future implementation

- Initialize the RPC client, then send the `initialized` notification before account or generation calls. Use managed device-code login for the headless deployment candidate, rather than copying tokens into the API-key provider.
- Follow `model/list.result.nextCursor` and validate the exact `model` and `supportedReasoningEfforts` after authentication. An unsigned-in catalog does not establish account access. Do not inherit the API provider's default `none` effort blindly.
- Keep `thread/start` ephemeral with dedicated instructions and explicit context suppression. `ephemeral`, `baseInstructions`, `outputSchema`, and `effort` are stable protocol fields; empty environments/workspace roots require the experimental capability. `dynamicTools: []` does not disable built-ins.
- Correlate notifications by thread and turn. Collect final agent output and require `turn/completed` with `turn.status === "completed"`; commentary, a retryable `error`, and an individual item completion are not success. Validate the resulting facts contract separately.
- Handle nullable or absent login IDs in completion notifications, and both `canceled` and `notFound` cancellation results. `account/logout` takes no parameters (or `null`). Never expose the raw RPC interface to browsers.

Remaining validation: actual OAuth completion/refresh and restart persistence; authenticated Luna availability and quotas; upstream reasoning-effort acceptance; enforceable isolation against adversarial inputs; an enforceable generation budget; and Alpine Linux amd64/arm64 runtime compatibility. No production Codex provider or login UI is included in this change.

## Current documented Codex model catalog

As checked on 2026-09-06: `gpt-5.6-luna`, `gpt-5.6-terra`, `gpt-5.6-sol`, `gpt-6-astra` (rollout/access restrictions), and `gpt-5.5` (other-model category). `gpt-5.3-codex-spark` is a Pro-only text research preview and should not be copied into the ordinary API picker. Account-specific availability should ultimately come from `model/list` after sign-in.

The [documented GPT-5.4 retirement](https://learn.chatgpt.com/docs/enterprise/workspace-model-availability#prepare-for-the-gpt-54-retirement) took effect for Codex ChatGPT sign-in on August 31, 2026; it explicitly does not retire those models from API-key access. The app's broader old-picker migration to Luna follows the requested inexpensive-facts policy.
