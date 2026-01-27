---
task: self-review
chatmode: reviewer
tools: [read, glob, grep]
---

# Task: Self Review

> **Purpose:** Review own code before committing
> **Chatmode:** Reviewer (read-only)
> **When:** After implementation, before commit

## Steps

1. **Review the diff** - Look at all changes
2. **Check for issues** - Apply checklist
3. **Note findings** - Document concerns
4. **Recommend action** - Proceed or fix

## Review Checklist

### Code Quality
- [ ] Code is readable and clear
- [ ] Functions are focused (single responsibility)
- [ ] Variable names are descriptive
- [ ] No unnecessary complexity
- [ ] No code duplication

### Logic
- [ ] Logic is correct
- [ ] Edge cases handled
- [ ] Error handling appropriate
- [ ] No obvious bugs

### Style
- [ ] Follows project conventions
- [ ] Consistent with surrounding code
- [ ] No magic numbers/strings
- [ ] Comments explain "why" not "what"

### Security
- [ ] No hardcoded secrets
- [ ] Input validated
- [ ] No XSS vulnerabilities
- [ ] No injection vulnerabilities

### Performance
- [ ] No obvious performance issues
- [ ] No unnecessary loops
- [ ] No memory leaks

## Commands

```bash
# View staged changes
git diff --staged

# View all changes
git diff

# View changes in specific file
git diff path/to/file.ts
```

## Severity Levels

| Level | Icon | Meaning |
|-------|------|---------|
| Critical | 🔴 | Must fix before commit |
| Warning | 🟡 | Should fix, may proceed |
| Suggestion | 🔵 | Nice to have |
| Note | 💬 | Observation only |

## Output Format

```markdown
## Self-Review: [Change Summary]

### Summary
[Overall assessment: Ready / Needs work]

### Critical Issues 🔴
- [File:line] - [Issue description]

### Warnings 🟡
- [File:line] - [Issue description]

### Suggestions 🔵
- [File:line] - [Improvement idea]

### Positive Notes
- [What's done well]

### Recommendation
[Proceed with commit / Fix issues first]
```

## Tips

- Review as if someone else wrote it
- Take a mental break before reviewing
- Check the actual diff, not just the files
- Look for patterns across changes

## Transition

After self-review:
- No critical issues → `commit/stage-changes`
- Critical issues → `implement/edit-file` to fix
- Questions → `plan/clarify-requirements`
