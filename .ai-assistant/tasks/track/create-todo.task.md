---
task: create-todo
chatmode: developer
tools: [read, write, glob]
---

# Task: Create Todo

> **Purpose:** Document technical debt or deferred work
> **Chatmode:** Developer
> **When:** Taking shortcuts or deferring work

## Steps

1. **Identify what's deferred** - What work is being postponed?
2. **Document context** - Why and what's the impact?
3. **Create todo file** - In `.ai-project/todos/`
4. **Link resources** - Related code, issues, docs

## When to Create Todos

- Taking a shortcut for speed
- Deferring non-critical work
- Noting tech debt discovered
- Ideas for future improvement
- Known issues not fixing now

## Todo Template

Create file at `.ai-project/todos/YYYY-MM-DD-name.md`:

```markdown
# Todo: [Short Title]

**Created:** [YYYY-MM-DD]
**Status:** Open
**Priority:** [Low | Medium | High | Critical]

## Context

[Why this todo exists]

## Description

[What needs to be done]

## Affected Areas

- `path/to/file.ts` - [how it's affected]

## Acceptance Criteria

- [ ] [Criterion 1]
- [ ] [Criterion 2]

## Related

- Issue: #[number]
- PR: #[number]
- Todo: [other todo]

## Notes

[Additional context]
```

## Priority Guidelines

| Priority | Meaning | When |
|----------|---------|------|
| Critical | Blocking/Security | Fix ASAP |
| High | Important debt | Fix soon |
| Medium | Should fix | Next opportunity |
| Low | Nice to have | When convenient |

## Status Values

- `Open` - Not started
- `In Progress` - Being worked on
- `Completed` - Done
- `Cancelled` - No longer needed

## File Naming

```
.ai-project/todos/
├── 2024-01-15-auth-refactor.md
├── 2024-01-16-test-coverage.md
└── 2024-01-17-performance-fix.md
```

## Output Format

```markdown
## Todo Created

**File:** `.ai-project/todos/2024-01-15-auth-refactor.md`
**Title:** Refactor authentication module
**Priority:** Medium

**Summary:** [Brief description]

**Next:** Continue with current task
```

## Tips

- Be specific about what needs to be done
- Include enough context for future you
- Link to specific code locations
- Set realistic priority
