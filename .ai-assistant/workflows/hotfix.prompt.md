---
workflow: hotfix
priority: high
---

# Workflow: Hotfix

> **Purpose:** Emergency bug fix with abbreviated validation for production issues
> **Phases:** Triage → Fix → Verify → Deploy
> **Command:** `/hotfix [scope flags] <issue description>`
> **Scope:** See [scope.md](../scope.md)

## When to Use

Use HOTFIX when:
- Production is broken and needs immediate fix
- Critical security vulnerability discovered
- Data corruption or loss occurring
- User-blocking bug with no workaround

**Do NOT use for:**
- Non-urgent bugs (use `/debug` instead)
- Feature requests
- Performance improvements
- Code cleanup

## Scope Flags

| Flag | Description |
|------|-------------|
| `--files=<paths>` | Known affected files |
| `--ticket=<id>` | Issue/ticket reference |
| `--severity=<level>` | `critical` / `high` (default: critical) |

**Examples:**
```bash
/hotfix --ticket=PROD-123 users cannot login
/hotfix --files=src/auth/ --severity=critical session tokens expiring
/hotfix payment processing failing for credit cards
```

## Task Composition

```
┌─────────────────────────────────────────────────────────────────┐
│ TRIAGE PHASE (Debugger) - ABBREVIATED                           │
├─────────────────────────────────────────────────────────────────┤
│ debug/gather-symptoms → debug/locate-root-cause                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                         ⛔ GATE: User confirms root cause
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ FIX PHASE (Developer) - MINIMAL CHANGES ONLY                    │
├─────────────────────────────────────────────────────────────────┤
│ implement/edit-file → test/write-regression → verify/run-typecheck │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                         ⛔ GATE: User approves fix
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ VERIFY PHASE (Tester) - SCOPED VALIDATION                       │
├─────────────────────────────────────────────────────────────────┤
│ verify/run-typecheck → test/run-tests (affected only)           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ DOCS PHASE (Developer) - OPTIONAL, LIGHTWEIGHT                   │
├─────────────────────────────────────────────────────────────────┤
│ docs/update-docs (if issue revealed doc gap)                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ DEPLOY PHASE (Committer)                                        │
├─────────────────────────────────────────────────────────────────┤
│ commit/create-commit → release/create-pr                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Triage (Debugger)

**Chatmode:** 🐛 Debugger
**Goal:** Quickly identify root cause - skip extensive exploration

### Step 1.1: Gather Symptoms (Fast)

```markdown
## Hotfix Triage

**Issue:** [from user input]
**Severity:** [critical/high]
**Ticket:** [if provided]

### Symptoms
- **What's broken:** [specific behavior]
- **Error message:** [if any]
- **Affected users:** [scope of impact]
- **When started:** [if known]
```

### Step 1.2: Quick Investigation

```bash
# Check recent changes
git log --oneline -10

# If files known, check recent changes to them
git log --oneline -5 -- [affected-files]

# Search for obvious issues
grep -r "TODO\|FIXME\|HACK" [affected-files]
```

### Step 1.3: Identify Root Cause

**Keep investigation brief - this is an emergency.**

```markdown
## Root Cause Identification

**Most likely cause:** [specific issue]
**Evidence:** [what points to this]
**Confidence:** [high/medium]

**Affected files:**
- `path/to/file.ts` - [what's wrong]

**Confirm this is the root cause?** (yes / investigate more)
```

**⛔ GATE: Confirm root cause before fixing.**

---

## Phase 2: Fix (Developer)

**Chatmode:** 👨‍💻 Developer
**Goal:** Minimal change to fix the issue - no refactoring

### Step 2.1: Plan Minimal Fix

```markdown
## Hotfix Plan

> **IMPORTANT:** Hotfixes should be MINIMAL.
> Fix only the immediate issue. Save improvements for later.

**Root cause:** [confirmed cause]

**Minimal fix:**
- `file.ts` line N: [specific change]

**What this fix does:**
[Brief explanation]

**What this fix does NOT do:**
- [ ] Refactoring
- [ ] Performance improvements
- [ ] Additional features
- [ ] Code cleanup

**Approve this minimal fix?** (yes / suggest alternative)
```

**⛔ GATE: User must approve fix approach.**

### Step 2.2: Implement Fix

```markdown
## Implementing Hotfix

**File:** `path/to/file.ts`
**Change:** [description]
```

**Apply the minimal fix.**

### Step 2.3: Add Regression Test

> **REQUIRED:** Every hotfix must include a regression test to prevent recurrence.

```markdown
## Regression Test

**Test file:** `path/to/file.spec.ts`
**Test case:** [describes the bug scenario]

\`\`\`typescript
it('should [not reproduce the bug] when [trigger condition]', () => {
  // Reproduce the exact conditions that caused the bug
  // Assert that the fix prevents it
});
\`\`\`
```

**Keep regression test minimal but effective:**
- Test the specific failing scenario
- Use realistic inputs that triggered the bug
- Assert the correct behavior after the fix

### Step 2.4: Type Check

```bash
npm run typecheck
```

**If type errors:**

```markdown
> **WARNING:**
> Type errors found. These must be resolved before proceeding.
>
> [List errors]
```

---

## Phase 3: Verify (Tester)

**Chatmode:** 🧪 Tester
**Goal:** Scoped validation - only affected code

### Step 3.1: Run Scoped Tests

```bash
# Type check (required)
npm run typecheck

# Lint (quick)
npm run lint -- [affected-files]

# Regression test (MUST pass)
npm run test -- [regression-test-file]

# Other affected tests
npm run test -- [affected-test-pattern]
```

### Step 3.2: Verification Report

```markdown
## Hotfix Verification

| Check | Scope | Status |
|-------|-------|--------|
| Type check | Full | ✓ Pass |
| Lint | Affected files | ✓ Pass |
| Regression test | New test | ✓ Pass |
| Affected tests | Existing tests | ✓ Pass (N tests) |

**Manual verification needed:**
- [ ] [Specific thing to verify manually]

**Verification complete?** (yes / found issues)
```

**⛔ GATE: All tests (especially the regression test) must pass before deployment.**

**If tests fail:**

```markdown
> **WARNING:**
> Tests failing. This must be resolved before deploying.
>
> **Options:**
> 1. Fix the failing tests
> 2. Adjust the hotfix approach
> 3. Skip tests (DANGEROUS - requires explicit approval)
>
> **How to proceed?**
```

---

## Phase 4: Docs (Developer) - Optional

**Chatmode:** 👨‍💻 Developer
**Goal:** Quick documentation if issue revealed a gap

> **Note:** Keep this lightweight. Hotfixes need to ship fast.

```markdown
## Documentation (Optional)

**Did this issue reveal a documentation gap?**

- `ai` - Update AI context (gotcha, edge case discovered)
- `readme` - Update README (if user-facing)
- `skip` - No docs needed (default for most hotfixes)
```

**⏸️ If `skip` (most common), proceed immediately to deploy.**

---

## Phase 5: Deploy (Committer)

**Chatmode:** 💾 Committer
**Goal:** Fast-track commit and PR

### Step 5.1: Create Hotfix Commit

```markdown
## Hotfix Commit

**Files changed:**
- `path/to/file.ts`

**Commit message:**
```
fix: [brief description]

[HOTFIX] [TICKET-ID if provided]

Root cause: [one line explanation]
```

**Create commit?** (yes / edit)
```

**⏸️ Wait for confirmation.**

```bash
git add [affected-files]
git commit -m "fix: [description]

[HOTFIX] [TICKET-ID]

Root cause: [explanation]"
```

### Step 5.2: Create PR or Push

**If on feature branch:**

```markdown
## Create Hotfix PR

**Title:** `[HOTFIX] [description]`
**Base:** `main`
**Labels:** `hotfix`, `priority:critical`

**PR Body:**
```markdown
## 🚨 HOTFIX

**Issue:** [description]
**Ticket:** [TICKET-ID]

### Root Cause
[Brief explanation]

### Fix
[What was changed]

### Testing
- [x] Type check passing
- [x] Affected tests passing
- [ ] Manual verification: [what to verify]

### Rollback
If issues occur, revert commit [sha].
```

**Create PR?** (yes / push directly)
```

**If approved:**

```bash
git push -u origin HEAD
gh pr create --title "[HOTFIX] [description]" --body "..." --label hotfix,priority:critical
```

### Step 5.3: Deployment Notes

```markdown
## Hotfix Ready

**PR:** [URL]
**Branch:** [branch name]
**Commit:** [sha]

### Next Steps
1. Get PR reviewed (expedited)
2. Merge to main
3. Deploy to production
4. Verify fix in production
5. Monitor for regressions

### Rollback Plan
```bash
git revert [commit-sha]
```

**Hotfix complete!** 🚑
```

---

## Quick Reference

| Phase | Chatmode | Focus | Gate |
|-------|----------|-------|------|
| Triage | 🐛 Debugger | Quick root cause | User confirms |
| Fix | 👨‍💻 Developer | Minimal change + regression test | **User approves** |
| Verify | 🧪 Tester | Regression + scoped tests | **All tests pass** |
| Docs | 👨‍💻 Developer | Doc gap check | *Optional* |
| Deploy | 💾 Committer | Fast PR | User confirms |

---

## Rules

### Prohibited
- ❌ Refactoring during hotfix
- ❌ Adding features
- ❌ Extensive code cleanup
- ❌ Skipping type check
- ❌ Deploying with failing tests (without explicit approval)

### Required
- ✓ Minimal fix only - one issue, one fix
- ✓ User confirmation of root cause
- ✓ User approval of fix approach
- ✓ Regression test added for the bug
- ✓ Type check must pass
- ✓ All tests (including regression) must pass
- ✓ Rollback plan documented

### Recommended
- 💡 Link to ticket/issue
- 💡 Add `[HOTFIX]` label to PR
- 💡 Document root cause for post-mortem
- 💡 Create follow-up todo for proper fix if hotfix is a workaround

---

## Post-Hotfix Actions

After the hotfix is deployed:

1. **Create follow-up todo** if the fix is a workaround:
   ```bash
   /create-todo --category=tech-debt --priority=high "Proper fix for [issue]"
   ```

2. **Schedule post-mortem** for critical issues

3. **Update documentation** if not done in Phase 4 (Docs)

4. **Verify regression test coverage** - confirm the regression test added during the fix adequately covers the bug scenario

---

**See Also:**
- [Workflow: Debug](./debug.prompt.md) - For non-urgent bugs
- [Workflow: Commit](./commit.prompt.md)
- [Workflow: Create PR](./create-pr.prompt.md)
- [Tasks: docs/](../tasks/docs/)
