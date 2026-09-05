# Facts live smoke comparison — 2026-09-06

Seven live requests used the production OpenAI request builder/parser, no retries, and fixed public music examples. This is a small smoke comparison, not a general quality benchmark.

| Model / effort | Valid responses | Mean latency | Completion tokens (total) | Reasoning tokens (total) |
|---|---:|---:|---:|---:|
| Luna / none | 3/3 | 3.46 s | 515 | 0 |
| Luna / low | 3/3 | 5.64 s | 1234 | 669 |
| GPT-5 Mini / minimal | 1/1 | 2.14 s | 211 | 0 |

Luna used a 2048-token cap and compared Beatles/Abbey Road/Come Together, quoted Bowie/Heroes metadata, and a Portuguese Milton Nascimento example. The GPT-5 Mini run used the Beatles case at the reported 4096-token cap. It completed with five facts and 211 completion tokens using minimal reasoning.

Luna `none` used approximately 58% fewer completion tokens than `low` in these three cases and returned four or five facts per request. All requests finished normally and passed structure/count checks; Portuguese output and quote handling were manually inspected. Factual accuracy was not scored or independently verified.

This supports `none` as the inexpensive default for the tested short-facts workload. Account/model availability, content quality, cache behavior, and latency may differ on other inputs. No live validation of Astra, GPT-5.5, or ChatGPT subscription login was performed.

Reproduce with the opt-in commands in [Facts generation](../facts-generation.md). Raw samples contain no credentials and were kept outside the repository.
