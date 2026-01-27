---
task: review-pr
chatmode: reviewer
tools: [read, glob, grep, bash]
---

# Task: Review Pull Request

> **Purpose:** Comprehensive review of a pull request
> **Chatmode:** Reviewer (read-only)
> **Output:** Structured review with actionable feedback

## Steps

1. **Get PR context** - Branch, description, linked issues
2. **Review the diff** - All changes in the PR
3. **Check quality** - Apply review checklist
4. **Test understanding** - Verify behavior makes sense
5. **Write review** - Structured feedback

## Getting PR Information

```bash
# View PR details
gh pr view [number]

# View PR diff
gh pr diff [number]

# View PR files changed
gh pr view [number] --json files

# Get commits in PR
gh pr view [number] --json commits
```

## Review Checklist

### Understanding
- [ ] PR description is clear
- [ ] Changes match description
- [ ] Scope is appropriate (not too large)

### Code Quality
- [ ] Code is readable
- [ ] Logic is correct
- [ ] Error handling is appropriate
- [ ] No code duplication

### Tests
- [ ] Changes are tested
- [ ] Test coverage is adequate
- [ ] Tests are meaningful (not just coverage)

### Security
- [ ] No security vulnerabilities
- [ ] Secrets are not exposed
- [ ] Input is validated

### Performance
- [ ] No obvious performance issues
- [ ] No N+1 queries
- [ ] Appropriate caching

### Documentation
- [ ] Code comments where needed
- [ ] API changes documented
- [ ] README updated if needed

## Feedback Format

Use these prefixes:
- `[Required]` - Must fix before merge
- `[Suggestion]` - Recommended improvement
- `[Question]` - Needs clarification
- `[Nitpick]` - Minor style preference

## Output Format

```markdown
## PR Review: #[number] - [title]

### Summary
[Overall assessment: Approve / Request Changes / Comment]

### Required Changes 🔴
1. `file.ts:42` - [Required] [issue description]
   ```typescript
   // Suggested fix
   ```

### Suggestions 🟡
1. `file.ts:88` - [Suggestion] [improvement idea]

### Questions ❓
1. `file.ts:100` - [Question] Why is [thing] done this way?

### Positive Notes 👍
- [What's done well]
- [Good patterns used]

### Testing
- [ ] Tests pass
- [ ] Tested locally (if applicable)

### Verdict
**[Approve / Request Changes / Comment]**
[Summary of decision]
```

## Transition

After review:
- If approving → Add approval comment
- If requesting changes → Post review, wait for updates
- If questions → Post as comment, wait for response
