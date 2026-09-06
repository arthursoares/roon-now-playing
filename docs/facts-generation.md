# Facts generation and operating costs

For a new OpenAI configuration, select `gpt-5.6-luna` in Admin → AI Facts. It is the recommended inexpensive model for this short text task. Current models and custom IDs are preserved. The old OpenAI picker entries migrate to Luna on load and on submitted updates; custom prompts, credentials, and explicitly saved token caps remain intact.

## Reasoning and output limits

The picker lists GPT-5.6 Luna/Terra/Sol, GPT-5.5, and GPT-6 Astra. GPT-5.6 and GPT-5.5 use `none` reasoning by default; Astra uses its minimum supported `low` setting. Availability still depends on the account. The original GPT-5 request path remains usable by the comparison script with `minimal` reasoning, because those models do not support `none`. Normal saved configurations for the retired app choices migrate to Luna. Supported reasoning models use strict structured output, converted back to the existing `facts: string[]` response.

Recommended starting ceilings are 2048 tokens for GPT-5.6/GPT-5.5 and 8192 for Astra (and direct legacy GPT-5 comparison calls); other providers retain 1024. Existing explicitly saved limits are not raised automatically. Model switches carry a recommended ceiling forward only if the old ceiling still matched its recommendation; custom values stay intact. The Use recommended button is an explicit way to reset that budget.

An output ceiling is not a target, and OpenAI completion limits include hidden reasoning tokens. A GPT-5 request can therefore exhaust 4096 tokens before emitting useful facts. Lowering reasoning effort is often more useful than continually raising the ceiling. At the lowest effort, errors instead suggest fewer/shorter facts or a larger ceiling. These defaults are starting points, not a guarantee of quality or token use.

The GPT-5.6 controls expose `none` through `xhigh` with the installed SDK. `max` and Pro mode are intentionally outside this inexpensive-facts integration; no SDK upgrade or extra runtime dependency is required.

## Catalog and configuration migration

The current API picker uses the API-capable models listed in the [Codex model catalog](https://learn.chatgpt.com/docs/models): Luna, Terra, Sol, GPT-5.5, and Astra. Codex Spark is a subscription-specific research preview and is not offered as a normal API model. This catalog does not imply this app already has OAuth, or that every account has every model.

Exact old app choices `gpt-5`, `gpt-5-mini`, `gpt-5-nano`, `gpt-4.1`, `gpt-4o`, `gpt-4o-mini`, plus `gpt-5.4`/`gpt-5.4-mini`, migrate to Luna and the cheapest reasoning setting. The `gpt-5.6` alias canonicalizes to Sol without changing its effective model tier. Other current/custom IDs and other providers are preserved.

This is an application catalog/cost decision, not a claim that all of those models retired from the OpenAI API. In particular, the documented GPT-5.4 retirement applies to Codex with ChatGPT sign-in; API-key access is a separate availability boundary.

## Request and cache ownership

- The client keeps a 500 ms track-change debounce and rejects stale responses. It aborts obsolete browser requests and no longer maintains its own persistent facts cache.
- One server cache serves every display. Matching concurrent misses share a single model request and a single stored result.
- Persistent cache identity includes normalized artist/album/title and generation-affecting settings: provider, model, prompt, count, output ceiling, effective reasoning, and the local endpoint only when using a local model. Display rotation and API keys do not invalidate successful facts.
- In-flight work additionally separates credential identities, so changing an API key does not join a pending request made with the old key. Raw keys are never persisted or logged in cache identity.
- Shared provider work finishes and caches a successful result when one browser disconnects; it may still be useful to another display. Browser cancellation is not presented as cancellation of a billed model request.
- Cache entries expire after 72 hours, are capped at 1000, and are written asynchronously using atomic replacement. Old entries without generation-configuration provenance are discarded once on upgrade. This can cause an initial regeneration, while valid saved configuration is preserved.
- Provider calls have a two-minute deadline and zero automatic retries. There is no automatic larger-model fallback. Failed, empty, refused, or explicitly truncated results are not cached. Admin Test bypasses the result cache intentionally.

Only an exact match of the old default prompt migrates to the shorter default. Custom prompts remain unchanged. Track fields must be nonempty strings of at most 500 characters; configuration is validated at the server boundary before generating or persisting it.

## Opt-in live comparison

The evaluation script uses the production OpenAI request builder and parser. By default it is a dry run and makes no network calls:

```sh
pnpm eval:facts
```

With `OPENAI_API_KEY` already set, explicitly opt in to billed calls:

```sh
pnpm eval:facts --run --output /tmp/luna-facts-evaluation.json
```

This compares Luna `none` and `low` on three public examples, including quoted titles and Portuguese output. Each request is capped at 2048 output tokens, with no retries. The report records latency, finish reason, API token usage, facts, and structural validity. It stops on authentication, model-access, or quota/rate-limit errors and never logs the key or raw SDK errors.

To check the reported original GPT-5 Mini case at 4096 tokens:

```sh
pnpm eval:facts --run --model gpt-5-mini --efforts minimal --limit 1 --max-output-tokens 4096 --output /tmp/gpt5-mini-facts-evaluation.json
```

Review the saved facts and language manually. Schema/count checks do not prove factual accuracy. Availability and usage depend on the authenticated account; mocked tests do not prove live model support.

The [recorded live smoke results](evaluations/2026-09-06-facts-luna.md) show the initial none/low comparison and the 4096-token GPT-5 Mini regression check.

## Sign-in scope

Facts generation retains API-key authentication. Optional [device-code account connection](codex-device-login.md) now supports ChatGPT sign-in, status, cancellation, and logout. Generating facts through that subscription remains separate work; see [the design and runtime findings](facts-openai-signin.md). API billing is independent of a ChatGPT subscription.

## Official references

- [GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna)
- [Original GPT-5 reasoning](https://developers.openai.com/api/docs/models/gpt-5)
- [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
