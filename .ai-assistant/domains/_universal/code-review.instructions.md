---
applyTo: "**/*"
priority: high
role: [reviewer, developer]
---

# Code Review Guidelines

> **Applies to:** All pull requests and code changes
> **Related:** [git.instructions.md](./git.instructions.md) | [documentation.instructions.md](./documentation.instructions.md)

## Core Principles

1. **Be constructive** - Focus on improvement, not criticism
2. **Be specific** - Point to exact lines, suggest alternatives
3. **Be timely** - Review within 24 hours when possible
4. **Be thorough** - Check functionality, readability, security
5. **Be collaborative** - Discussion, not gatekeeping

## Review Checklist

### Functionality

- [ ] Does the code do what it's supposed to do?
- [ ] Are edge cases handled?
- [ ] Are error conditions handled gracefully?
- [ ] Does it break existing functionality?
- [ ] Are there any race conditions or timing issues?

### Code Quality

- [ ] Is the code readable and self-documenting?
- [ ] Are variable/function names descriptive?
- [ ] Is there unnecessary duplication?
- [ ] Is the code complexity appropriate?
- [ ] Does it follow project patterns and conventions?

### Security

- [ ] Is user input validated?
- [ ] Are there SQL injection vulnerabilities?
- [ ] Are there XSS vulnerabilities?
- [ ] Are secrets properly handled (not hardcoded)?
- [ ] Are permissions checked appropriately?

### Performance

- [ ] Are there obvious performance issues?
- [ ] Are database queries efficient (N+1, missing indexes)?
- [ ] Is unnecessary work being done?
- [ ] Are there memory leaks?

### Testing

- [ ] Are there sufficient tests?
- [ ] Do tests cover edge cases?
- [ ] Are tests readable and maintainable?
- [ ] Do tests actually test the right things?

### Documentation

- [ ] Is complex logic documented?
- [ ] Are public APIs documented?
- [ ] Is the PR description clear?
- [ ] Are breaking changes documented?

## Comment Types

### Use Labels

Prefix comments to indicate importance:

```markdown
**[blocking]** This introduces a security vulnerability that must be fixed.

**[suggestion]** Consider using `Map` instead of object for better performance.

**[nit]** Typo in variable name: `recieve` → `receive`.

**[question]** What's the reason for this approach? I'm curious about the tradeoffs.

**[praise]** Great refactor! This is much clearer than before.
```

### Comment Categories

| Label | Meaning | Blocks PR? |
|-------|---------|------------|
| `[blocking]` | Must be addressed before merge | Yes |
| `[suggestion]` | Recommended improvement | No |
| `[nit]` | Minor style/formatting issue | No |
| `[question]` | Seeking clarification | No |
| `[praise]` | Positive feedback | No |

## Giving Feedback

### Be Specific

```markdown
<!-- Bad - vague -->
This code is confusing.

<!-- Good - specific -->
**[suggestion]** The variable `d` on line 45 is unclear. Consider renaming
to `dateOfBirth` or `createdAt` to indicate what date this represents.
```

### Explain Why

```markdown
<!-- Bad - no context -->
Don't use `any` here.

<!-- Good - explains reasoning -->
**[blocking]** Using `any` here defeats TypeScript's type safety. This function
receives user input, so we need proper types to catch validation issues at
compile time. Consider using a Zod schema or a specific interface.
```

### Suggest Alternatives

```markdown
<!-- Bad - just criticism -->
This loop is inefficient.

<!-- Good - provides solution -->
**[suggestion]** This loop has O(n²) complexity. Consider using a Map for O(n):

\`\`\`typescript
const userMap = new Map(users.map(u => [u.id, u]));
orders.forEach(order => {
  const user = userMap.get(order.userId);
});
\`\`\`
```

### Ask Questions

```markdown
**[question]** I see we're caching this response for 1 hour. What's the
reasoning behind this duration? Are there cases where stale data could
cause issues?
```

### Give Praise

```markdown
**[praise]** Really clean implementation of the retry logic. The exponential
backoff with jitter is a nice touch that will help prevent thundering herd.
```

## Receiving Feedback

### Don't Take It Personally

Code review is about the code, not you. Even experienced developers get
feedback on their code.

### Respond to All Comments

- Address or acknowledge every comment
- If you disagree, explain your reasoning
- If you agree, make the change

### Ask for Clarification

```markdown
@reviewer I'm not sure I understand the concern here. Could you elaborate
on what scenario you're worried about?
```

### Don't Resolve Others' Comments

Let the reviewer resolve their own comments after they're satisfied.
This ensures nothing is missed.

## Review Process

### Before Submitting PR

**Author responsibilities:**

1. Self-review your changes first
2. Run tests and linter locally
3. Write clear PR description
4. Keep PRs small and focused (< 400 lines ideal)
5. Respond to automated checks

### During Review

**Author:**
- Respond promptly to feedback
- Push fixes as new commits (easier to re-review)
- Request re-review when ready

**Reviewer:**
- Complete review in one pass if possible
- Approve when satisfied, don't block on nits
- Use "Request Changes" only for blocking issues

### After Approval

1. Squash commits if appropriate
2. Ensure CI passes
3. Merge (author or reviewer, per team convention)
4. Delete branch

## PR Size Guidelines

### Keep PRs Small

| Lines Changed | Assessment |
|--------------|------------|
| < 100 | Excellent |
| 100-400 | Good |
| 400-800 | Consider splitting |
| > 800 | Should split |

### Splitting Large Changes

Break into logical chunks:
1. Refactoring (no behavior change)
2. New feature implementation
3. Tests
4. Documentation

Stack PRs if needed:
```
feature-base → feature-part-1 → feature-part-2 → main
```

## Review Anti-Patterns

### Avoid These

**Rubber-stamping:**
```markdown
<!-- Don't just approve without looking -->
LGTM 👍
```

**Nitpicking:**
```markdown
<!-- Don't block on minor style issues -->
**[blocking]** Use double quotes instead of single quotes.
```

**Bikeshedding:**
```markdown
<!-- Don't spend time on trivial decisions -->
I think `fetchUsers` is better than `getUsers`. Actually, maybe
`retrieveUsers` is clearest. Let's discuss...
```

**Personal Attacks:**
```markdown
<!-- Never do this -->
Why would you write it this way? This is terrible.
```

**Passive-Aggressive:**
```markdown
<!-- Be direct instead -->
Well, I suppose this works...
```

## Automated Checks

### Required Before Review

- [ ] CI pipeline passes
- [ ] Type checking passes
- [ ] Linting passes
- [ ] Tests pass
- [ ] Coverage requirements met

### Automated Tools

Configure these to catch issues before human review:

```yaml
# .github/workflows/pr-checks.yml
name: PR Checks
on: [pull_request]
jobs:
  checks:
    runs-on: {{CI_RUNNER}}
    steps:
      - uses: actions/checkout@v4
      - run: {{INSTALL_COMMAND}}
      - run: {{TYPECHECK_COMMAND}}
      - run: {{LINT_COMMAND}}
      - run: {{TEST_COMMAND}}
```

## Time Expectations

| Action | Target Time |
|--------|-------------|
| Initial review | < 24 hours |
| Follow-up review | < 4 hours |
| Author response | < 24 hours |
| Total PR lifetime | < 3 days |

## Known Gotchas

### Context Switching Cost

Reviewing is expensive. Block time for reviews rather than context-switching.

### Stale Reviews

If code changes significantly after review, request fresh review.

### Review Depth

Small PRs get more thorough reviews. Large PRs often get superficial reviews.

### Bus Factor

Avoid single-reviewer teams. Multiple perspectives catch more issues.

---

**See Also:**
- [Git Guidelines](./git.instructions.md)
- [Documentation Guidelines](./documentation.instructions.md)
- [Testing Guidelines](./testing.instructions.md)
