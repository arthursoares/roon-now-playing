---
workflow: create-todo
priority: medium
---

# Create Todo

> **Purpose:** Document deferred work, shortcuts, and technical debt for future resolution
> **Template:** [.ai-project/todos/_template.md](../../.ai-project/todos/_template.md)

## When to Create a Todo

Create a todo entry when:

- Taking a shortcut that should be addressed later
- Identifying technical debt during development
- Discovering issues that are out of scope for current work
- Noting improvements that would require significant effort
- Deferring non-critical work to maintain focus

## Todo Categories

| Category | Description | Examples |
|----------|-------------|----------|
| `tech-debt` | Code that works but needs improvement | Hardcoded values, missing abstractions |
| `refactor` | Code structure improvements | Pattern migrations, file reorganization |
| `feature` | Missing functionality | Incomplete implementations, TODO comments |
| `bug` | Known issues not yet fixed | Edge cases, race conditions |
| `performance` | Performance improvements | Optimization opportunities |
| `docs` | Documentation needs | Missing API docs, outdated guides |
| `test` | Testing improvements | Missing tests, flaky tests |

## Priority Levels

| Priority | Description | Action Timeline |
|----------|-------------|-----------------|
| `high` | Blocking or high-impact | Address soon |
| `medium` | Should be addressed | Next opportunity |
| `low` | Nice to have | When time permits |

## Creating a Todo

### Step 1: Create the File

Create a new file in `.ai-project/todos/`:

```bash
.ai-project/todos/{descriptive-name}.md
```

**Naming conventions:**
- Use kebab-case
- Be descriptive but concise
- Include category if helpful: `refactor-api-client.md`, `tech-debt-config-loading.md`

### Step 2: Use the Template

Copy from `_template.md` and fill in:

```markdown
---
id: {unique-id}
title: Brief Descriptive Title
priority: medium
category: tech-debt
status: open
created: {YYYY-MM-DD}
updated: {YYYY-MM-DD}
labels: []
---

# Brief Descriptive Title

## Description

Clear description of what needs to be done and why.

## Context

| Aspect | Details |
|--------|---------|
| **Shortcut Taken** | What compromise was made |
| **Reason** | Why it couldn't be done properly at the time |
| **Proper Solution** | What the ideal solution would look like |

## Affected Files

| File | Changes Needed |
|------|----------------|
| `path/to/file.ts` | Description of changes |

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3
```

### Step 3: Link Related Resources

Add references to related work:

```markdown
## Related

- **Todos:** [related-todo-id](./related-todo-id.md)
- **Issues:** [#123](https://github.com/org/repo/issues/123)
- **Documentation:** [Link to relevant docs](../path/to/doc.md)
```

## Example Todo

```markdown
---
id: refactor-api-client
title: Refactor API Client to Use Interceptors
priority: medium
category: refactor
status: open
created: 2025-01-15
updated: 2025-01-15
labels: [api, architecture]
---

# Refactor API Client to Use Interceptors

## Description

The current API client handles authentication and error logging inline in each request. This should be refactored to use axios interceptors for cleaner separation of concerns.

## Context

| Aspect | Details |
|--------|---------|
| **Shortcut Taken** | Added auth headers directly in each API call |
| **Reason** | Needed to ship feature quickly, interceptor setup was out of scope |
| **Proper Solution** | Create request/response interceptors for auth, logging, and error handling |

## Affected Files

| File | Changes Needed |
|------|----------------|
| `src/services/api/client.ts` | Add interceptor configuration |
| `src/services/api/auth.ts` | Move auth logic to interceptor |
| `src/services/api/*.ts` | Remove inline auth handling |

## Acceptance Criteria

- [ ] Request interceptor adds auth headers automatically
- [ ] Response interceptor handles common error codes
- [ ] Logging interceptor captures request/response for debugging
- [ ] All API modules cleaned up from inline handling
- [ ] Tests updated for new pattern

## Subtasks

- [ ] `create-interceptors`: Create base interceptor configuration
- [ ] `migrate-auth`: Move auth logic to request interceptor
- [ ] `migrate-errors`: Add response interceptor for error handling
- [ ] `cleanup-modules`: Remove inline handling from API modules
```

## Todo Lifecycle

1. **Created** - Todo documented with full context
2. **In Progress** - Actively being worked on
3. **Completed** - Work finished, todo can be archived
4. **Cancelled** - No longer relevant, document why

## Maintaining Todos

### Regular Review

- Review open todos periodically
- Update priorities based on current needs
- Close completed or obsolete todos

### When Completing

- Verify all acceptance criteria met
- Update status to `completed`
- Add completion notes if helpful
- Consider if documentation needs updating

---

## References

- [Todo Template](../../.ai-project/todos/_template.md)
- [Todos README](../../.ai-project/todos/README.md)
