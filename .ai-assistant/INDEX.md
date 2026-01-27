# Documentation Index

> Quick lookup for patterns, errors, and topics across all AI instruction files.

---

## Workflows

| Command | Workflow | Purpose |
|---------|----------|---------|
| `/explore` | [explore.prompt.md](./workflows/explore.prompt.md) | Understand code (read-only) |
| `/plan` | [plan.prompt.md](./workflows/plan.prompt.md) | Design approach before coding |
| `/implement` | [implement.prompt.md](./workflows/implement.prompt.md) | Full workflow: explore → plan → code → commit |
| `/debug` | [debug.prompt.md](./workflows/debug.prompt.md) | Find and fix bugs |
| `/validate` | [validate.prompt.md](./workflows/validate.prompt.md) | Run type check, lint, tests |
| `/commit` | [commit.prompt.md](./workflows/commit.prompt.md) | Review and commit changes |
| `/pr` | [create-pr.prompt.md](./workflows/create-pr.prompt.md) | Create pull request |
| `/refactor` | [refactor.prompt.md](./workflows/refactor.prompt.md) | Multi-file changes with tracking |
| `/review` | [review-branch.prompt.md](./workflows/review-branch.prompt.md) | Review branch changes |
| `/cover` | [cover.prompt.md](./workflows/cover.prompt.md) | Add test coverage |
| `/wrap` | [wrap.prompt.md](./workflows/wrap.prompt.md) | Wrap up work session |
| `/docs` | [docs.prompt.md](./workflows/docs.prompt.md) | Documentation tasks |
| `/init` | [init.prompt.md](./workflows/init.prompt.md) | Initialize project config |
| `/hotfix` | [hotfix.prompt.md](./workflows/hotfix.prompt.md) | Emergency fixes |
| `/release` | [release.prompt.md](./workflows/release.prompt.md) | Release management |
| `/deps` | [deps.prompt.md](./workflows/deps.prompt.md) | Dependency updates |
| `/revert` | [revert.prompt.md](./workflows/revert.prompt.md) | Revert changes |
| `/sync` | [sync.prompt.md](./workflows/sync.prompt.md) | Sync branches |
| `/create-todo` | [create-todo.prompt.md](./workflows/create-todo.prompt.md) | Track deferred work |
| `/file-list` | [create-file-list.prompt.md](./workflows/create-file-list.prompt.md) | Track batch operations |
| `/add-story` | [add-story.prompt.md](./workflows/add-story.prompt.md) | Add Storybook story for component |

---

## Chatmodes

| Mode | File | Purpose |
|------|------|---------|
| 🔍 Explorer | [explorer.chatmode.md](./chatmodes/explorer.chatmode.md) | Read-only exploration |
| 📋 Planner | [planner.chatmode.md](./chatmodes/planner.chatmode.md) | Design and planning |
| 👨‍💻 Developer | [developer.chatmode.md](./chatmodes/developer.chatmode.md) | Code implementation |
| 🧪 Tester | [tester.chatmode.md](./chatmodes/tester.chatmode.md) | Testing and QA |
| 👁️ Reviewer | [reviewer.chatmode.md](./chatmodes/reviewer.chatmode.md) | Code review |
| 🏗️ Architect | [architect.chatmode.md](./chatmodes/architect.chatmode.md) | Architecture decisions |
| 🐛 Debugger | [debugger.chatmode.md](./chatmodes/debugger.chatmode.md) | Problem diagnosis |
| 💾 Committer | [committer.chatmode.md](./chatmodes/committer.chatmode.md) | Git commits |
| ♻️ Refactorer | [refactorer.chatmode.md](./chatmodes/refactorer.chatmode.md) | Multi-file changes |
| 🚀 Releaser | [releaser.chatmode.md](./chatmodes/releaser.chatmode.md) | PRs and releases |

---

## Domain Guidelines

Domains are organized by category. During `/init`, relevant domains are copied to `.ai-project/domains/` based on your stack.

### Universal (Always Included)
| Domain | File | Topics |
|--------|------|--------|
| Git | [git.instructions.md](./domains/_universal/git.instructions.md) | Branches, commits |
| Code Review | [code-review.instructions.md](./domains/_universal/code-review.instructions.md) | Review guidelines |
| Security | [security.instructions.md](./domains/_universal/security.instructions.md) | Security practices |
| Documentation | [documentation.instructions.md](./domains/_universal/documentation.instructions.md) | Doc guidelines |
| Communication | [communication.instructions.md](./domains/_universal/communication.instructions.md) | User interaction |

### Language
| Domain | File | Topics |
|--------|------|--------|
| TypeScript | [typescript.instructions.md](./domains/language/typescript.instructions.md) | Types, imports, exports |

### Testing
| Domain | File | Topics |
|--------|------|--------|
| Vitest | [vitest.instructions.md](./domains/testing/vitest.instructions.md) | Test plans, mocking (Vitest) |

### Framework
| Domain | File | Topics |
|--------|------|--------|
| Storybook (React) | [react.instructions.md](./domains/storybook/react.instructions.md) | Stories, play functions |

### API & Data
| Domain | File | Topics |
|--------|------|--------|
| REST API (TS) | [typescript-rest.instructions.md](./domains/api/typescript-rest.instructions.md) | REST, requests, responses |
| Validation (Zod) | [zod.instructions.md](./domains/validation/zod.instructions.md) | Input validation |
| Database (Prisma) | [prisma.instructions.md](./domains/database/prisma.instructions.md) | Database patterns |

### Code Quality
| Domain | File | Topics |
|--------|------|--------|
| Naming (TS) | [typescript.instructions.md](./domains/naming/typescript.instructions.md) | Naming conventions |
| Error Handling (TS) | [typescript.instructions.md](./domains/error-handling/typescript.instructions.md) | Error patterns |
| Logging (TS) | [typescript.instructions.md](./domains/logging/typescript.instructions.md) | Logging patterns |
| Performance (TS) | [typescript.instructions.md](./domains/performance/typescript.instructions.md) | Optimization |

### DevOps
| Domain | File | Topics |
|--------|------|--------|
| CI/CD (GitHub Actions) | [github-actions-node.instructions.md](./domains/ci-cd/github-actions-node.instructions.md) | Pipelines |
| Docker (Node) | [node.instructions.md](./domains/docker/node.instructions.md) | Containers |
| Env Config (Node) | [node.instructions.md](./domains/env-config/node.instructions.md) | Environment variables |

---

## By Topic

### TypeScript
- **Avoid `any` type** → [typescript.instructions.md](./domains/language/typescript.instructions.md#avoid-any-type)
- **`satisfies` vs `as`** → [typescript.instructions.md](./domains/language/typescript.instructions.md#use-satisfies-instead-of-as)
- **Named exports only** → [typescript.instructions.md](./domains/language/typescript.instructions.md#named-exports-only)
- **Type guards** → [typescript.instructions.md](./domains/language/typescript.instructions.md#type-guards)

### Testing
- **Test plan format (Gherkin)** → [vitest.instructions.md](./domains/testing/vitest.instructions.md#test-plan-format)
- **Testing Library queries** → [vitest.instructions.md](./domains/testing/vitest.instructions.md#testing-library-queries)
- **Mocking patterns** → [vitest.instructions.md](./domains/testing/vitest.instructions.md#mocking)

### Storybook
- **Story file structure** → [react.instructions.md](./domains/storybook/react.instructions.md#story-file-structure)
- **Play functions** → [react.instructions.md](./domains/storybook/react.instructions.md#interaction-tests-with-play)
- **MSW mocking** → [react.instructions.md](./domains/storybook/react.instructions.md#mocking)
- **Query strategies** → [react.instructions.md](./domains/storybook/react.instructions.md#query-strategies)

### Git
- **Branch naming** → [git.instructions.md](./domains/_universal/git.instructions.md#branch-naming)
- **Commit messages** → [git.instructions.md](./domains/_universal/git.instructions.md#commit-messages)

---

## By Pattern

### Data Patterns
- **Type guards** → `function isType(value: unknown): value is Type`
- **Discriminated unions** → `type Result = { success: true; data: T } | { success: false; error: string }`

### Testing Patterns
- **Test plan** → Gherkin format at top of test file
- **Scoped tests** → `npm run test -- ComponentName`

### Storybook Patterns
- **Story factory** → `const createStory = (args, config) => ({ args, ...config })`
- **Play function** → `play: async ({ canvasElement, step }) => { ... }`
- **Component query** → `within(canvasElement).getByRole('button')`
- **Global query** → `screen.getByRole('dialog')` for modals/toasts

---

## Project Layer Template

When `/init` is run, these templates are copied to `.ai-project/`:

| Template | Purpose |
|----------|---------|
| [.memory.md](./.ai-project/.memory.md) | Project architecture & stack |
| [.context.md](./.ai-project/.context.md) | Common patterns & imports |
| [project/](./ai-project/project/) | Project configuration |
| [todos/](./.ai-project/todos/) | Technical debt tracking |
| [history/](./.ai-project/history/) | Knowledge from past work |
| [decisions/](./.ai-project/decisions/) | Architecture Decision Records |
| [file-lists/](./.ai-project/file-lists/) | Batch operation tracking |

---

## Provider Configurations

Choose the right configuration for your AI assistant:

| Provider | File | Recommendation |
|----------|------|----------------|
| Claude Code | [claude.provider.md](./providers/claude.provider.md) | **Recommended** - Full feature support |
| Cursor | [cursor.provider.md](./providers/cursor.provider.md) | Good for inline edits |
| GitHub Copilot | [copilot.provider.md](./providers/copilot.provider.md) | Code suggestions only |
| Windsurf | [windsurf.provider.md](./providers/windsurf.provider.md) | Similar to Cursor |
| Gemini | [gemini.provider.md](./providers/gemini.provider.md) | Experimental |

**Compatibility Matrix:** [providers/README.md](./providers/README.md)

---

## Configuration

### Project Config

Override framework defaults in `.ai-project/config.md`:

```yaml
use_emojis: true       # false for text-only output
message_style: detailed # 'detailed' or 'compact'
auto_validate: true    # Run checks after changes
commit_style: conventional # 'conventional', 'ticket', 'simple'
```

---

## Navigation

**Entry Point:** [.instructions.md](./.instructions.md)

**Reference:**
- [scope.md](./scope.md) - Scope flags and inheritance
- [README.md](./README.md) - Framework overview
- [CHANGELOG.md](../CHANGELOG.md) - Version history and migration notes

---

**Tip:** Use Ctrl+F to search this index for keywords.
